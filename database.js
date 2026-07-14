import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve('runs.db');
const db = new sqlite3.Database(dbPath);

export function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Create runs table
      db.run(`
        CREATE TABLE IF NOT EXISTS runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          commitId TEXT UNIQUE,
          author TEXT,
          timestamp TEXT,
          message TEXT,
          model TEXT,
          promptTemplate TEXT,
          chunkSize INTEGER,
          chunkOverlap INTEGER,
          topK INTEGER,
          hallucinationRate REAL,
          answerRelevancy REAL,
          faithfulness REAL,
          avgLatency INTEGER,
          p50Latency INTEGER,
          p95Latency INTEGER,
          totalCost REAL,
          passed INTEGER,
          failureReason TEXT
        )
      `);

      // 2. Create test_results table
      db.run(`
        CREATE TABLE IF NOT EXISTS test_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          runId INTEGER,
          testId TEXT,
          category TEXT,
          question TEXT,
          modelOutput TEXT,
          latency INTEGER,
          cost REAL,
          relevancy REAL,
          faithfulness REAL,
          isHallucinating INTEGER,
          status TEXT,
          FOREIGN KEY(runId) REFERENCES runs(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) return reject(err);
        
        // Seed default history if empty
        db.get("SELECT COUNT(*) as count FROM runs", (err, row) => {
          if (err) return reject(err);
          if (row.count === 0) {
            seedDefaultHistory()
              .then(resolve)
              .catch(reject);
          } else {
            resolve();
          }
        });
      });
    });
  });
}

async function seedDefaultHistory() {
  const historyJsonPath = path.resolve('src/data/runs_history.json');
  if (!fs.existsSync(historyJsonPath)) return;
  
  const history = JSON.parse(fs.readFileSync(historyJsonPath, 'utf8'));
  console.log(`Seeding SQLite database with ${history.length} historical runs...`);

  for (const run of history) {
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO runs (
          commitId, author, timestamp, message, model, promptTemplate,
          chunkSize, chunkOverlap, topK, hallucinationRate, answerRelevancy,
          faithfulness, avgLatency, p50Latency, p95Latency, totalCost, passed, failureReason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        run.commitId, run.author, run.timestamp, run.message, run.model, run.promptTemplate,
        run.ragConfig.chunkSize, run.ragConfig.chunkOverlap, run.ragConfig.topK,
        run.metrics.hallucinationRate, run.metrics.answerRelevancy, run.metrics.faithfulness,
        run.metrics.avgLatency, run.metrics.p50Latency, run.metrics.p95Latency,
        run.metrics.totalCost, run.passed ? 1 : 0, run.failureReason
      ], function(err) {
        if (err) return reject(err);
        const runDbId = this.lastID;

        // Insert individual test cases
        const stmt = db.prepare(`
          INSERT INTO test_results (
            runId, testId, category, question, modelOutput,
            latency, cost, relevancy, faithfulness, isHallucinating, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const res of run.testResults) {
          stmt.run([
            runDbId, res.id, res.category, res.question, res.modelOutput,
            res.latency, res.cost, res.relevancy, res.faithfulness,
            res.isHallucinating ? 1 : 0, res.status
          ]);
        }
        stmt.finalize(resolve);
      });
    });
  }
}

export function getAllRuns() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM runs ORDER BY timestamp ASC", (err, runs) => {
      if (err) return reject(err);
      
      // Load test results for each run
      const runsWithResults = [];
      if (runs.length === 0) return resolve([]);
      
      let pending = runs.length;
      for (const run of runs) {
        db.all("SELECT * FROM test_results WHERE runId = ?", [run.id], (err, results) => {
          if (err) return reject(err);
          runsWithResults.push({
            commitId: run.commitId,
            author: run.author,
            timestamp: run.timestamp,
            message: run.message,
            model: run.model,
            promptTemplate: run.promptTemplate,
            ragConfig: {
              chunkSize: run.chunkSize,
              chunkOverlap: run.chunkOverlap,
              topK: run.topK
            },
            metrics: {
              hallucinationRate: run.hallucinationRate,
              answerRelevancy: run.answerRelevancy,
              faithfulness: run.faithfulness,
              avgLatency: run.avgLatency,
              p50Latency: run.p50Latency,
              p95Latency: run.p95Latency,
              totalCost: run.totalCost
            },
            passed: run.passed === 1,
            failureReason: run.failureReason,
            testResults: results.map(r => ({
              id: r.testId,
              category: r.category,
              question: r.question,
              modelOutput: r.modelOutput,
              latency: r.latency,
              cost: r.cost,
              relevancy: r.relevancy,
              faithfulness: r.faithfulness,
              isHallucinating: r.isHallucinating === 1,
              status: r.status
            }))
          });
          
          pending--;
          if (pending === 0) {
            // Sort to preserve chronological order
            runsWithResults.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            resolve(runsWithResults);
          }
        });
      }
    });
  });
}

export function insertRun(run) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      db.run(`
        INSERT INTO runs (
          commitId, author, timestamp, message, model, promptTemplate,
          chunkSize, chunkOverlap, topK, hallucinationRate, answerRelevancy,
          faithfulness, avgLatency, p50Latency, p95Latency, totalCost, passed, failureReason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        run.commitId, run.author, run.timestamp, run.message, run.model, run.promptTemplate,
        run.ragConfig.chunkSize, run.ragConfig.chunkOverlap, run.ragConfig.topK,
        run.metrics.hallucinationRate, run.metrics.answerRelevancy, run.metrics.faithfulness,
        run.metrics.avgLatency, run.metrics.p50Latency, run.metrics.p95Latency,
        run.metrics.totalCost, run.passed ? 1 : 0, run.failureReason
      ], function(err) {
        if (err) {
          db.run("ROLLBACK");
          return reject(err);
        }
        const runDbId = this.lastID;

        const stmt = db.prepare(`
          INSERT INTO test_results (
            runId, testId, category, question, modelOutput,
            latency, cost, relevancy, faithfulness, isHallucinating, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const res of run.testResults) {
          stmt.run([
            runDbId, res.id, res.category, res.question, res.modelOutput,
            res.latency, res.cost, res.relevancy, res.faithfulness,
            res.isHallucinating ? 1 : 0, res.status
          ]);
        }

        stmt.finalize((err) => {
          if (err) {
            db.run("ROLLBACK");
            return reject(err);
          }
          db.run("COMMIT", (err) => {
            if (err) return reject(err);
            resolve(runDbId);
          });
        });
      });
    });
  });
}
