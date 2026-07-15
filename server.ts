import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { initDb, getAllRuns, insertRun } from './database.js';
import type { EvalRun } from './src/types.js';

// Zero-dependency .env loader fallback
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const firstEq = trimmed.indexOf('=');
      if (firstEq !== -1) {
        const key = trimmed.substring(0, firstEq).trim();
        let val = trimmed.substring(firstEq + 1).trim();
        // Remove quotes if present
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const app = express();
const port = process.env.PORT || 5189;

app.use(express.json());

// In-memory rate limiting middleware
const rateLimits: Record<string, number[]> = {};
function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
  const now = Date.now();

  if (!rateLimits[ip]) {
    rateLimits[ip] = [];
  }

  // Keep only requests in the last 60 seconds
  rateLimits[ip] = rateLimits[ip].filter(timestamp => now - timestamp < 60000);

  if (rateLimits[ip].length >= 100) {
    return res.status(429).json({
      error: { message: "Too many requests. Rate limit is 100 requests per minute." }
    });
  }

  rateLimits[ip].push(now);
  next();
}

app.use(rateLimiter);

// Simple API Key secret authorization middleware for public endpoints
function authCheck(req: Request, res: Response, next: NextFunction) {
  const apiSecret = process.env.API_SECRET;
  if (apiSecret) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${apiSecret}`) {
      return res.status(403).json({
        error: { message: "Access forbidden. Missing or invalid Bearer API Secret token." }
      });
    }
  }
  next();
}

// Fail-closed variant for endpoints that mutate shared state: if no secret is
// configured, writes are refused rather than silently left open to anyone.
function requireAuthCheck(req: Request, res: Response, next: NextFunction) {
  const apiSecret = process.env.API_SECRET;
  if (!apiSecret) {
    return res.status(503).json({
      error: { message: "Server misconfiguration: API_SECRET is not set. Write endpoint is disabled." }
    });
  }
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${apiSecret}`) {
    return res.status(403).json({
      error: { message: "Access forbidden. Missing or invalid Bearer API Secret token." }
    });
  }
  next();
}

// Validates the shape of an incoming run payload before it ever reaches the
// database layer, so a malformed request fails with a clean 400 instead of
// a raw 500 from a missing/undefined nested field.
function validateRunPayload(run: unknown): string | null {
  if (!run || typeof run !== 'object') return "Request body must be a JSON object";
  const r = run as Record<string, unknown>;

  if (!r.commitId || typeof r.commitId !== 'string') return "Missing or invalid commitId";
  if (!r.model || typeof r.model !== 'string') return "Missing or invalid model";

  if (!r.ragConfig || typeof r.ragConfig !== 'object') return "Missing or invalid ragConfig";
  const ragConfig = r.ragConfig as Record<string, unknown>;
  for (const field of ['chunkSize', 'chunkOverlap', 'topK']) {
    if (typeof ragConfig[field] !== 'number') return `Missing or invalid ragConfig.${field}`;
  }

  if (!r.metrics || typeof r.metrics !== 'object') return "Missing or invalid metrics";
  const metrics = r.metrics as Record<string, unknown>;
  for (const field of ['hallucinationRate', 'answerRelevancy', 'faithfulness', 'avgLatency', 'p50Latency', 'p95Latency', 'totalCost']) {
    if (typeof metrics[field] !== 'number') return `Missing or invalid metrics.${field}`;
  }

  if (!Array.isArray(r.testResults)) return "Missing or invalid testResults array";

  return null;
}

// Expose server configuration details
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    hasServerKey: !!process.env.GEMINI_API_KEY
  });
});

// Expose run history from SQLite
app.get('/api/runs', async (_req: Request, res: Response) => {
  try {
    const runs = await getAllRuns();
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Expose runs insertion with validation checks
app.post('/api/runs/add', requireAuthCheck, async (req: Request, res: Response) => {
  const validationError = validateRunPayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const run = req.body as EvalRun;

  try {
    const insertId = await insertRun(run);
    res.json({ success: true, id: insertId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

interface GeminiPayload {
  contents: { parts: { text: string }[] }[];
  generationConfig?: {
    responseMimeType: string;
    responseSchema: {
      type: string;
      properties: Record<string, { type: string; description?: string }>;
      required: string[];
    };
  };
}

// Proxy route for Gemini API queries with prompt validation
app.post('/api/eval', authCheck, async (req: Request, res: Response) => {
  const { prompt, useStructuredSchema, clientApiKey } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({
      error: { message: "Required parameter 'prompt' is missing or empty." }
    });
  }

  const apiKey = process.env.GEMINI_API_KEY || clientApiKey || '';

  if (!apiKey) {
    return res.status(401).json({
      error: { message: "API key missing. Provide GEMINI_API_KEY on the server or enter a key in the Simulator UI." }
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload: GeminiPayload = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  // Configure structured schema if requested (judge NLI grading)
  if (useStructuredSchema) {
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          faithfulness: { type: "NUMBER", description: "Score from 0.0 to 1.0 indicating factual agreement" },
          relevancy: { type: "NUMBER", description: "Score from 0.0 to 1.0 indicating answers the query" },
          isHallucinating: { type: "BOOLEAN", description: "True if response extrapolates beyond context" }
        },
        required: ["faithfulness", "relevancy", "isHallucinating"]
      }
    };
  }

  try {
    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await apiResponse.json() as { error?: { message?: string } };

    if (!apiResponse.ok || data.error) {
      return res.status(apiResponse.status || 400).json({
        error: { message: data.error?.message || `Google API error ${apiResponse.status}` }
      });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: { message: (err as Error).message } });
  }
});

// Serve frontend assets in production
const distPath = path.resolve('dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Only bind to a real port when run directly (`node server.ts` / `npm start`).
// Test suites import `app` and drive it with supertest instead.
const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  initDb()
    .then(() => {
      app.listen(port, () => {
        console.log(`🚀 LLM Eval Proxy backend listening at http://localhost:${port}`);
      });
    })
    .catch((err) => {
      console.error("❌ Failed to initialize SQLite database:", err);
      process.exit(1);
    });
}

export { app };
