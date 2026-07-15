import fs from 'fs';
import path from 'path';
import { initDb, insertRun } from '../database.ts';
import { parseJudgeOutput } from '../src/utils/judgeParser.ts';
import { simulateTestResult, buildJudgePrompt, testResultStatus, aggregateMetrics, evaluateGates } from '../src/utils/evalEngine.ts';
import type { EvalRun, GoldenDatasetItem, TestResult } from '../src/types.ts';

type CliArgs = Record<string, string | boolean>;

// Helper to parse arguments
function getArgs(): CliArgs {
  const args: CliArgs = {};
  process.argv.slice(2).forEach(val => {
    if (val.startsWith('--')) {
      const parts = val.substring(2).split('=');
      const key = parts[0];
      const value = parts[1] || true;
      args[key] = value;
    }
  });
  return args;
}

function argString(args: CliArgs, key: string, fallback: string): string {
  const value = args[key];
  return typeof value === 'string' ? value : fallback;
}

const args = getArgs();

// Default configurations if not provided
const model = argString(args, 'model', 'gpt-4o-mini');
const promptTemplate = argString(args, 'prompt', 'System: Rely ONLY on the provided context to answer the user query.\n\nContext:\n{{context}}\n\nQuestion: {{question}}');
const chunkSize = parseInt(argString(args, 'chunkSize', '400')) || 400;
const chunkOverlap = parseInt(argString(args, 'chunkOverlap', '50')) || 50;
const topK = parseInt(argString(args, 'topK', '3')) || 3;
const author = argString(args, 'author', 'CI/CD Runner');
const message = argString(args, 'message', `Automated run for model ${model}`);
const evalSubset = parseInt(argString(args, 'subset', '100')) || 100; // Limit subset for fast API testing

console.log('==================================================');
console.log('🤖 LLM EVAL CI/CD PIPELINE RUNNER');
console.log('==================================================');
console.log(`Model:             ${model}`);
console.log(`Chunk Size:        ${chunkSize}`);
console.log(`Chunk Overlap:     ${chunkOverlap}`);
console.log(`Top-K:             ${topK}`);
console.log(`Prompt Template:   "${promptTemplate.substring(0, 50)}..."`);
console.log('--------------------------------------------------');

// Load golden dataset
const datasetPath = path.resolve('src/data/golden_dataset.json');

if (!fs.existsSync(datasetPath)) {
  console.error(`❌ Golden dataset not found at ${datasetPath}`);
  process.exit(1);
}

const goldenDataset: GoldenDatasetItem[] = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

console.log(`📋 Loaded ${goldenDataset.length} test cases.`);
const subsetItems = goldenDataset.slice(0, evalSubset);
console.log(`🚀 Running evaluations on subset of ${subsetItems.length} cases...`);

async function run() {
  // Initialize DB first
  await initDb();

  const testResults: TestResult[] = [];

  const useRealAPI = model === 'gemini-1.5-flash';
  const apiKey = argString(args, 'apiKey', '') || process.env.GEMINI_API_KEY || '';

  if (useRealAPI && !apiKey) {
    console.error('❌ ERROR: Gemini API key required for real evaluation runs. Use --apiKey=<key> or set GEMINI_API_KEY env.');
    process.exit(1);
  }

  for (let index = 0; index < subsetItems.length; index++) {
    const item = subsetItems[index];
    let modelOutput = '';
    let latency = 0;
    let cost = 0;
    let faithfulness = 1.0;
    let relevancy = 0.92;
    let isHallucinating = false;

    if (useRealAPI) {
      const startTime = Date.now();

      // Step 1: Query the model under test
      try {
        const promptText = promptTemplate
          .replace('{{context}}', item.reference_context)
          .replace('{{question}}', item.question);

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          })
        });

        const data = await response.json() as { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string }[] } }[] };

        // FAIL LOUDLY AND VISIBLY ON API ERROR
        if (!response.ok || data.error) {
          const errMsg = data.error?.message || `HTTP error ${response.status}`;
          console.error(`\n🚨 LIVE API RUN FAILED LOUDLY AND VISIBLY:`);
          console.error(`Error Message: ${errMsg}`);
          process.exit(1);
        }

        modelOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        latency = Date.now() - startTime;
      } catch (err) {
        console.error(`\n🚨 CONNECTION FAILURE EXPOSED LOUDLY:`);
        console.error(`Details: ${(err as Error).message}`);
        process.exit(1);
      }

      // Step 2: LLM-as-a-Judge Evaluation (Structured responseSchema to avoid NaN bugs)
      try {
        const judgePrompt = buildJudgePrompt(item.question, item.reference_context, modelOutput);

        const judgeResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: judgePrompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  faithfulness: { type: "NUMBER" },
                  relevancy: { type: "NUMBER" },
                  isHallucinating: { type: "BOOLEAN" }
                },
                required: ["faithfulness", "relevancy", "isHallucinating"]
              }
            }
          })
        });

        const judgeData = await judgeResponse.json() as { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string }[] } }[] };

        // FAIL LOUDLY ON JUDGE ERROR
        if (!judgeResponse.ok || judgeData.error) {
          const errMsg = judgeData.error?.message || `HTTP error ${judgeResponse.status}`;
          console.error(`\n🚨 LLM-AS-A-JUDGE EVALUATION FAILED LOUDLY:`);
          console.error(`Error: ${errMsg}\n`);
          process.exit(1);
        }

        const judgeText = judgeData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsedJudge = parseJudgeOutput(judgeText);

        faithfulness = parsedJudge.faithfulness;
        relevancy = parsedJudge.relevancy;
        isHallucinating = parsedJudge.isHallucinating;
      } catch (err) {
        console.error(`\n🚨 LLM-AS-A-JUDGE SCORING FAILURE:`);
        console.error(`Details: ${(err as Error).message}\n`);
        process.exit(1);
      }
    } else {
      // Simulation Path (mock heuristics, shared with the web dashboard)
      const simulated = simulateTestResult({ model, promptTemplate, chunkSize, topK, itemId: item.id });
      latency = simulated.latency;
      cost = simulated.cost;
      relevancy = simulated.relevancy;
      faithfulness = simulated.faithfulness;
      isHallucinating = simulated.isHallucinating;
      modelOutput = simulated.modelOutput;
    }

    console.log(`  [${index + 1}/${subsetItems.length}] Tested node ${item.id} - Latency: ${latency}ms, Faithfulness: ${(faithfulness*100).toFixed(0)}%, Status: ${isHallucinating ? '⚠️ Hallucinated' : 'Passed'}`);

    testResults.push({
      id: item.id,
      category: item.category,
      question: item.question,
      modelOutput,
      latency,
      cost,
      relevancy,
      faithfulness,
      isHallucinating,
      status: testResultStatus({ isHallucinating, latency })
    });

    // Rate limiting delay for live API
    if (useRealAPI && index < subsetItems.length - 1) {
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  const metrics = aggregateMetrics(testResults);
  const { gateHallucinationPassed, gateLatencyPassed, gateFaithfulnessPassed, passed, failureReason } = evaluateGates(metrics);

  const newCommitId = Math.random().toString(16).substring(2, 9);
  const newRun: EvalRun = {
    commitId: argString(args, 'commit', newCommitId),
    author,
    timestamp: new Date().toISOString(),
    message,
    model,
    promptTemplate,
    isSimulated: !useRealAPI,
    ragConfig: { chunkSize, chunkOverlap, topK },
    metrics: {
      hallucinationRate: metrics.hallucinationRate,
      answerRelevancy: metrics.answerRelevancy,
      faithfulness: metrics.faithfulness,
      avgLatency: metrics.avgLatency,
      p50Latency: metrics.p50Latency,
      p95Latency: metrics.p95Latency,
      totalCost: parseFloat(metrics.totalCost.toFixed(5))
    },
    passed,
    failureReason,
    testResults
  };

  // Insert the run details to SQLite database
  await insertRun(newRun);

  console.log('--------------------------------------------------');
  console.log('📊 EVALUATION COMPLETE');
  console.log('--------------------------------------------------');
  console.log(`Hallucination Rate: ${(metrics.hallucinationRate * 100).toFixed(1)}% ${gateHallucinationPassed ? '✅' : '❌ (> 5.0%)'}`);
  console.log(`Avg Relevancy:      ${(metrics.answerRelevancy * 100).toFixed(1)}%`);
  console.log(`Avg Faithfulness:   ${(metrics.faithfulness * 100).toFixed(1)}% ${gateFaithfulnessPassed ? '✅' : '❌ (< 90%)'}`);
  console.log(`p50 Latency:        ${metrics.p50Latency}ms`);
  console.log(`p95 Latency:        ${metrics.p95Latency}ms ${gateLatencyPassed ? '✅' : '❌ (> 2000ms)'}`);
  console.log(`Total Run Cost:     $${metrics.totalCost.toFixed(4)}`);
  console.log('--------------------------------------------------');

  if (passed) {
    console.log('🎉 SUCCESS: All quality gates passed! Saved to runs.db. Ready to merge.');
    process.exit(0);
  } else {
    console.error(`🚨 FAIL: Quality gate check failed.`);
    console.error(`Reason: ${failureReason}`);
    process.exit(1);
  }
}

run();
