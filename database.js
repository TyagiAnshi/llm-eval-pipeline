import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve('runs.db');
const db = new sqlite3.Database(dbPath);

export function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Enable Write-Ahead Logging (WAL) mode for better concurrent performance
      db.run("PRAGMA journal_mode = WAL");

      // 1. Create runs table with isSimulated flag
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
          failureReason TEXT,
          isSimulated INTEGER DEFAULT 1
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
      `);

      // 3. Create index on test_results.runId for faster querying
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_test_results_runId ON test_results(runId)
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

function seedDefaultHistory() {
  return new Promise((resolve, reject) => {
    const historyJsonPath = path.resolve('src/data/runs_history.json');
    if (!fs.existsSync(historyJsonPath)) return resolve();
    
    const history = JSON.parse(fs.readFileSync(historyJsonPath, 'utf8'));
    console.log(`Seeding SQLite database with ${history.length} default runs...`);

    db.serialize(() => {
      db.run("BEGIN TRANSACTION", (err) => {
        if (err) return reject(err);

        let completed = 0;
        const total = history.length;

        if (total === 0) {
          db.run("COMMIT", (err) => err ? reject(err) : resolve());
          return;
        }

        const checkCompletion = () => {
          completed++;
          if (completed === total) {
            db.run("COMMIT", (err) => {
              if (err) {
                db.run("ROLLBACK");
                return reject(err);
              }
              resolve();
            });
          }
        };

        for (const run of history) {
          db.run(`
            INSERT INTO runs (
              commitId, author, timestamp, message, model, promptTemplate,
              chunkSize, chunkOverlap, topK, hallucinationRate, answerRelevancy,
              faithfulness, avgLatency, p50Latency, p95Latency, totalCost, passed, failureReason, isSimulated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
              ], (stmtErr) => {
                if (stmtErr) {
                  stmt.finalize();
                  db.run("ROLLBACK");
                  return reject(stmtErr);
                }
              });
            }
            stmt.finalize((finalizeErr) => {
              if (finalizeErr) {
                db.run("ROLLBACK");
                return reject(finalizeErr);
              }
              checkCompletion();
            });
          });
        }
      });
    });
  });
}

function getTestResults(runId) {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM test_results WHERE runId = ?", [runId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function getAllRuns() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM runs ORDER BY timestamp ASC", async (err, runs) => {
      if (err) return reject(err);
      if (runs.length === 0) return resolve([]);
      
      try {
        // Fix ordering fragility using Promise.all map
        const runsWithResults = await Promise.all(runs.map(async (run) => {
          const results = await getTestResults(run.id);
          return {
            commitId: run.commitId,
            author: run.author,
            timestamp: run.timestamp,
            message: run.message,
            model: run.model,
            promptTemplate: run.promptTemplate,
            isSimulated: run.isSimulated === 1,
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
          };
        }));
        resolve(runsWithResults);
      } catch (mapErr) {
        reject(mapErr);
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
          faithfulness, avgLatency, p50Latency, p95Latency, totalCost, passed, failureReason, isSimulated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        run.commitId, run.author, run.timestamp, run.message, run.model, run.promptTemplate,
        run.ragConfig.chunkSize, run.ragConfig.chunkOverlap, run.ragConfig.topK,
        run.metrics.hallucinationRate, run.metrics.answerRelevancy, run.metrics.faithfulness,
        run.metrics.avgLatency, run.metrics.p50Latency, run.metrics.p95Latency,
        run.metrics.totalCost, run.passed ? 1 : 0, run.failureReason, run.isSimulated ? 1 : 0
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
          ], (stmtErr) => {
            if (stmtErr) {
              stmt.finalize();
              db.run("ROLLBACK");
              return reject(stmtErr);
            }
          });
        }

        stmt.finalize((finalizeErr) => {
          if (finalizeErr) {
            db.run("ROLLBACK");
            return reject(finalizeErr);
          }
          db.run("COMMIT", (commitErr) => {
            if (commitErr) return reject(commitErr);
            resolve(runDbId);
          });
        });
      });
    });
  });
}
