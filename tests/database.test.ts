import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { EvalRun } from '../src/types.ts';

// Point database.ts at an isolated temp file before importing it, so this
// suite never touches the real runs.db used by `npm run dev` / `npm run eval`.
const testDbPath = path.join(os.tmpdir(), `solar-test-runs-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
process.env.RUNS_DB_PATH = testDbPath;

const { initDb, insertRun, getAllRuns } = await import('../database.ts');

function makeRun(overrides: Partial<EvalRun> = {}): EvalRun {
  return {
    commitId: `test-${Math.random().toString(16).slice(2)}`,
    author: 'Test Author',
    timestamp: new Date().toISOString(),
    message: 'test run',
    model: 'gpt-4o-mini',
    promptTemplate: 'Answer: {{question}} using {{context}}',
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
    testResults: [
      {
        id: 'T-001',
        category: 'Test',
        question: 'What is the answer?',
        modelOutput: 'The answer.',
        latency: 900,
        cost: 0.001,
        relevancy: 0.9,
        faithfulness: 0.95,
        isHallucinating: false,
        status: 'passed'
      }
    ],
    ...overrides
  };
}

beforeAll(async () => {
  await initDb();
});

afterAll(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    const p = testDbPath + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

describe('database', () => {
  it('seeds default history from src/data/runs_history.json on first init', async () => {
    const runs = await getAllRuns();
    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0]).toHaveProperty('commitId');
    expect(runs[0]).toHaveProperty('testResults');
  });

  it('insertRun persists a run retrievable via getAllRuns', async () => {
    const run = makeRun({ commitId: 'insert-test-1' });
    await insertRun(run);

    const runs = await getAllRuns();
    const found = runs.find(r => r.commitId === 'insert-test-1');
    expect(found).toBeDefined();
    expect(found?.author).toBe('Test Author');
    expect(found?.passed).toBe(true);
    expect(found?.isSimulated).toBe(true);
  });

  it('persists nested ragConfig, metrics, and testResults correctly', async () => {
    const run = makeRun({ commitId: 'insert-test-2' });
    await insertRun(run);

    const runs = await getAllRuns();
    const found = runs.find(r => r.commitId === 'insert-test-2');
    expect(found?.ragConfig).toEqual({ chunkSize: 400, chunkOverlap: 50, topK: 3 });
    expect(found?.metrics.faithfulness).toBeCloseTo(0.95);
    expect(found?.testResults).toHaveLength(1);
    expect(found?.testResults[0].id).toBe('T-001');
    expect(found?.testResults[0].isHallucinating).toBe(false);
  });

  it('returns runs ordered by timestamp ascending', async () => {
    const earlier = makeRun({ commitId: 'order-test-early', timestamp: '2020-01-01T00:00:00Z' });
    const later = makeRun({ commitId: 'order-test-late', timestamp: '2030-01-01T00:00:00Z' });
    await insertRun(later);
    await insertRun(earlier);

    const runs = await getAllRuns();
    const earlyIdx = runs.findIndex(r => r.commitId === 'order-test-early');
    const lateIdx = runs.findIndex(r => r.commitId === 'order-test-late');
    expect(earlyIdx).toBeGreaterThanOrEqual(0);
    expect(earlyIdx).toBeLessThan(lateIdx);
  });

  it('rejects a duplicate commitId due to the UNIQUE constraint', async () => {
    const run = makeRun({ commitId: 'dup-test' });
    await insertRun(run);
    await expect(insertRun(makeRun({ commitId: 'dup-test' }))).rejects.toThrow();
  });
});
