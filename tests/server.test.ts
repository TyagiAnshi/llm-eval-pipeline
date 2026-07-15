import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Isolate this suite's SQLite file from the real runs.db, and pin API_SECRET
// so the write-endpoint auth behavior is deterministic regardless of the
// developer's local .env.
const testDbPath = path.join(os.tmpdir(), `solar-test-server-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
process.env.RUNS_DB_PATH = testDbPath;
process.env.API_SECRET = 'test-secret-token';
delete process.env.GEMINI_API_KEY;

const { app } = await import('../server.ts');
const { initDb } = await import('../database.ts');

const validRunPayload = {
  commitId: `server-test-${Math.random().toString(16).slice(2)}`,
  author: 'Test Author',
  timestamp: new Date().toISOString(),
  message: 'test run',
  model: 'gpt-4o-mini',
  promptTemplate: 'Answer: {{question}}',
  isSimulated: true,
  ragConfig: { chunkSize: 400, chunkOverlap: 50, topK: 3 },
  metrics: {
    hallucinationRate: 0.02,
    answerRelevancy: 0.9,
    faithfulness: 0.95,
    avgLatency: 900,
    p50Latency: 850,
    p95Latency: 1200,
    totalCost: 0.001
  },
  passed: true,
  failureReason: '',
  testResults: []
};

beforeAll(async () => {
  await initDb();
});

afterAll(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    const p = testDbPath + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

describe('GET /api/config', () => {
  it('reports no server key when GEMINI_API_KEY is unset', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.hasServerKey).toBe(false);
  });
});

describe('GET /api/runs', () => {
  it('returns the seeded run history as an array', async () => {
    const res = await request(app).get('/api/runs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('POST /api/runs/add auth', () => {
  it('rejects requests with no bearer token', async () => {
    const res = await request(app).post('/api/runs/add').send(validRunPayload);
    expect(res.status).toBe(403);
  });

  it('rejects requests with the wrong bearer token', async () => {
    const res = await request(app)
      .post('/api/runs/add')
      .set('Authorization', 'Bearer wrong-token')
      .send(validRunPayload);
    expect(res.status).toBe(403);
  });

  it('accepts requests with the correct bearer token', async () => {
    const res = await request(app)
      .post('/api/runs/add')
      .set('Authorization', 'Bearer test-secret-token')
      .send(validRunPayload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/runs/add validation', () => {
  const auth = { Authorization: 'Bearer test-secret-token' };

  it('returns 400 for a missing commitId', async () => {
    const { commitId, ...rest } = validRunPayload;
    const res = await request(app).post('/api/runs/add').set(auth).send(rest);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commitId/i);
  });

  it('returns 400 for a missing ragConfig (the gap that used to 500)', async () => {
    const { ragConfig, ...rest } = validRunPayload;
    const res = await request(app)
      .post('/api/runs/add')
      .set(auth)
      .send({ ...rest, commitId: `${validRunPayload.commitId}-no-rag` });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ragConfig/i);
  });

  it('returns 400 for a non-numeric metrics field', async () => {
    const res = await request(app)
      .post('/api/runs/add')
      .set(auth)
      .send({
        ...validRunPayload,
        commitId: `${validRunPayload.commitId}-bad-metrics`,
        metrics: { ...validRunPayload.metrics, faithfulness: 'high' }
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/metrics/i);
  });

  it('returns 400 when testResults is not an array', async () => {
    const res = await request(app)
      .post('/api/runs/add')
      .set(auth)
      .send({ ...validRunPayload, commitId: `${validRunPayload.commitId}-bad-results`, testResults: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/testResults/i);
  });
});

describe('POST /api/eval', () => {
  it('returns 400 when prompt is missing', async () => {
    const res = await request(app)
      .post('/api/eval')
      .set('Authorization', 'Bearer test-secret-token')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 when no API key is available anywhere', async () => {
    const res = await request(app)
      .post('/api/eval')
      .set('Authorization', 'Bearer test-secret-token')
      .send({ prompt: 'hello' });
    expect(res.status).toBe(401);
  });
});

describe('rate limiting', () => {
  it('allows requests under the 100/min threshold', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).not.toBe(429);
  });
});
