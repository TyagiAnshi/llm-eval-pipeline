import express from 'express';
import path from 'path';
import fs from 'fs';
import { initDb, getAllRuns, insertRun } from './database.js';

const app = express();
const port = process.env.PORT || 5189;

app.use(express.json());

// Expose run history from SQLite
app.get('/api/runs', async (req, res) => {
  try {
    const runs = await getAllRuns();
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Expose runs insertion
app.post('/api/runs/add', async (req, res) => {
  try {
    const run = req.body;
    const insertId = await insertRun(run);
    res.json({ success: true, id: insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy route for Gemini API queries (includes structured schemas)
app.post('/api/eval', async (req, res) => {
  const { prompt, useStructuredSchema, clientApiKey } = req.body;
  const apiKey = process.env.GEMINI_API_KEY || clientApiKey || '';

  if (!apiKey) {
    return res.status(401).json({
      error: { message: "API key missing. Provide GEMINI_API_KEY in environment or input it in client." }
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
