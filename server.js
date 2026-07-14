import express from 'express';
import path from 'path';
import fs from 'fs';
import { initDb, getAllRuns, insertRun } from './database.js';

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
const rateLimits = {};
function rateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
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
function authCheck(req, res, next) {
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

// Expose server configuration details
app.get('/api/config', (req, res) => {
  res.json({
    hasServerKey: !!process.env.GEMINI_API_KEY
  });
});

// Expose run history from SQLite
app.get('/api/runs', async (req, res) => {
  try {
    const runs = await getAllRuns();
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Expose runs insertion with validation checks
app.post('/api/runs/add', authCheck, async (req, res) => {
  const run = req.body;

  // Basic request body validation
  if (!run.commitId || typeof run.commitId !== 'string') {
    return res.status(400).json({ error: "Missing or invalid commitId" });
  }
  if (!run.model || typeof run.model !== 'string') {
    return res.status(400).json({ error: "Missing or invalid model" });
  }
  if (!run.metrics || typeof run.metrics !== 'object') {
    return res.status(400).json({ error: "Missing or invalid metrics" });
  }
  if (!Array.isArray(run.testResults)) {
    return res.status(400).json({ error: "Missing or invalid testResults array" });
  }

  try {
    const insertId = await insertRun(run);
    res.json({ success: true, id: insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy route for Gemini API queries with prompt validation
app.post('/api/eval', authCheck, async (req, res) => {
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

  const payload = {
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

    const data = await apiResponse.json();

    if (!apiResponse.ok || data.error) {
      return res.status(apiResponse.status || 400).json({
        error: { message: data.error?.message || `Google API error ${apiResponse.status}` }
      });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// Serve frontend assets in production
const distPath = path.resolve('dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start server after initializing SQLite database
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
