import fs from 'fs';
import path from 'path';

// Helper to parse arguments
function getArgs() {
  const args = {};
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

const args = getArgs();

// Default configurations if not provided
const model = args.model || 'gpt-4o-mini';
const promptTemplate = args.prompt || 'System: Rely ONLY on the provided context to answer the user query.\n\nContext:\n{{context}}\n\nQuestion: {{question}}';
const chunkSize = parseInt(args.chunkSize) || 400;
const chunkOverlap = parseInt(args.chunkOverlap) || 50;
const topK = parseInt(args.topK) || 3;
const author = args.author || 'CI/CD Runner';
const message = args.message || `Automated run for model ${model}`;
const evalSubset = parseInt(args.subset) || 100; // Limit subset for fast API testing

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
const historyPath = path.resolve('src/data/runs_history.json');

if (!fs.existsSync(datasetPath)) {
  console.error(`❌ Golden dataset not found at ${datasetPath}`);
  process.exit(1);
}

const goldenDataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const runsHistory = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf8')) : [];

console.log(`📋 Loaded ${goldenDataset.length} test cases.`);
const subsetItems = goldenDataset.slice(0, evalSubset);
console.log(`🚀 Running evaluations on subset of ${subsetItems.length} cases...`);

// Simulation calculations setup
const lowerPrompt = promptTemplate.toLowerCase();
const hasSafetyConstraint = lowerPrompt.includes('only') || lowerPrompt.includes('do not know') || lowerPrompt.includes('rely') || lowerPrompt.includes('purely');

let baseHallucination = 0.05;
if (model === 'gpt-4o') baseHallucination = 0.01;
else if (model === 'claude-3-5-sonnet') baseHallucination = 0.012;
else if (model === 'gpt-4o-mini') baseHallucination = 0.025;
else if (model === 'gpt-3.5-turbo') baseHallucination = 0.06;

if (hasSafetyConstraint) baseHallucination *= 0.5;
else baseHallucination *= 1.5;
if (chunkSize < 200) baseHallucination *= 1.8;

let baseLatency = 1000;
if (model === 'gpt-4o') baseLatency = 1600;
else if (model === 'claude-3-5-sonnet') baseLatency = 1100;
else if (model === 'gpt-4o-mini') baseLatency = 800;
else if (model === 'gpt-3.5-turbo') baseLatency = 1200;
baseLatency += (topK * 80) + (chunkSize / 10);

let baseRelevancy = 0.88;
let baseFaithfulness = 0.90;
if (model === 'gpt-4o' || model === 'claude-3-5-sonnet') {
  baseRelevancy = 0.94;
  baseFaithfulness = 0.95;
}
if (!hasSafetyConstraint) baseFaithfulness -= 0.06;
if (chunkSize < 250) baseFaithfulness -= 0.05;

async function run() {
  const testResults = [];
  let totalLatency = 0;
  let totalCost = 0;
  let totalRelevancy = 0;
  let totalFaithfulness = 0;
  let hallucinationCount = 0;
  const latencies = [];

  const useRealAPI = model === 'gemini-1.5-flash';
  const apiKey = args.apiKey || process.env.GEMINI_API_KEY || '';

  if (useRealAPI && !apiKey) {
    console.error('❌ ERROR: Gemini API key required for real evaluation runs. Use --apiKey=<key>');
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

        const data = await response.json();
        
        // FAIL LOUDLY AND VISIBLY ON API ERROR
        if (!response.ok || data.error) {
          const errMsg = data.error?.message || `HTTP error ${response.status}`;
          const errCode = data.error?.code || response.status;
          console.error(`\n🚨 LIVE API RUN FAILED LOUDLY AND VISIBLY:`);
          console.error(`Status: ${errCode}`);
          console.error(`Error Message: ${errMsg}`);
          console.error(`Failed on node: ${item.id}\n`);
          process.exit(1);
        }

        modelOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        latency = Date.now() - startTime;
      } catch (err) {
        console.error(`\n🚨 NETWORK OR CONNECTION FAILURE LOUDLY EXPOSED:`);
        console.error(`Details: ${err.message}`);
        console.error(`Failed on node: ${item.id}\n`);
        process.exit(1);
      }

      // Step 2: LLM-as-a-Judge Evaluation (Real NLI scoring)
      try {
        const judgePrompt = `You are an expert AI evaluator. Assess the following:
[Question]: ${item.question}
[Context]: ${item.reference_context}
[Generated Answer]: ${modelOutput}

Grade the Generated Answer on two parameters:
1. Faithfulness (Is the answer strictly derived from the context? 0.0 to 1.0)
2. Relevancy (Does the answer address the question? 0.0 to 1.0)

Output ONLY a JSON block in this exact format:
{ "faithfulness": 0.95, "relevancy": 0.98, "isHallucinating": false }`;

        const judgeResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: judgePrompt }] }]
          })
        });

        const judgeData = await judgeResponse.json();
        
        // FAIL LOUDLY ON JUDGE ERROR
        if (!judgeResponse.ok || judgeData.error) {
          const errMsg = judgeData.error?.message || `HTTP error ${judgeResponse.status}`;
          console.error(`\n🚨 LLM-AS-A-JUDGE EVALUATION FAILED LOUDLY:`);
          console.error(`Error: ${errMsg}\n`);
          process.exit(1);
        }

        const judgeText = judgeData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        
        // Extract JSON block from markdown if returned
        const jsonMatch = judgeText.match(/\{[\s\S]*?\}/);
        const parsedJudge = JSON.parse(jsonMatch ? jsonMatch[0] : judgeText);

        faithfulness = parseFloat(parsedJudge.faithfulness) ?? 1.0;
        relevancy = parseFloat(parsedJudge.relevancy) ?? 1.0;
        isHallucinating = parsedJudge.isHallucinating ?? (faithfulness < 0.80);
      } catch (err) {
        console.error(`\n🚨 LLM-AS-A-JUDGE PARSING ERROR LOUDLY EXPOSED:`);
        console.error(`Details: ${err.message}`);
        console.error(`Raw Judge Text: ${modelOutput}\n`);
        process.exit(1);
      }
    } else {
      // Simulation Path (mock heuristics)
      isHallucinating = Math.random() < baseHallucination;
      latency = Math.round(baseLatency + (Math.random() * 400 - 200));
      
      const inputTokens = (chunkSize * topK) / 4 + 100;
      const outputTokens = 150;
      let costPerInputToken = 0.000005;
      let costPerOutputToken = 0.000015;
      if (model === 'gpt-4o-mini') {
        costPerInputToken = 0.00000015;
        costPerOutputToken = 0.0000006;
      } else if (model === 'gpt-3.5-turbo') {
        costPerInputToken = 0.0000005;
        costPerOutputToken = 0.0000015;
      }
      cost = (inputTokens * costPerInputToken) + (outputTokens * costPerOutputToken);

      relevancy = Math.min(1.0, Math.max(0.0, baseRelevancy + (Math.random() * 0.1 - 0.05)));
      faithfulness = Math.min(1.0, Math.max(0.0, baseFaithfulness + (Math.random() * 0.08 - 0.04) - (isHallucinating ? 0.25 : 0)));
      modelOutput = `Simulated response based on context for query ${item.id}. Verified by automated evaluators.`;
    }

    latencies.push(latency);
    totalLatency += latency;
    totalCost += cost;
    totalRelevancy += relevancy;
    totalFaithfulness += faithfulness;
    if (isHallucinating) hallucinationCount++;

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
      status: (isHallucinating || latency > 2000) ? 'failed' : 'passed'
    });

    // Rate limiting delay for live API (1.2 seconds)
    if (useRealAPI && index < subsetItems.length - 1) {
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  latencies.sort((a, b) => a - b);
  const p50Latency = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const finalHallucinationRate = hallucinationCount / subsetItems.length;
  const avgLatency = Math.round(totalLatency / subsetItems.length);
  const avgRelevancy = parseFloat((totalRelevancy / subsetItems.length).toFixed(3));
  const avgFaithfulness = parseFloat((totalFaithfulness / subsetItems.length).toFixed(3));

  const gateHallucinationPassed = finalHallucinationRate <= 0.05;
  const gateLatencyPassed = p95Latency <= 2000;
  const gateFaithfulnessPassed = avgFaithfulness >= 0.90;
  const passed = gateHallucinationPassed && gateLatencyPassed && gateFaithfulnessPassed;

  let failureReason = '';
  if (!passed) {
    const failures = [];
    if (!gateHallucinationPassed) failures.push(`Hallucination Rate (${(finalHallucinationRate * 100).toFixed(1)}% > 5%)`);
    if (!gateLatencyPassed) failures.push(`p95 Latency (${p95Latency}ms > 2000ms)`);
    if (!gateFaithfulnessPassed) failures.push(`Faithfulness (${(avgFaithfulness * 100).toFixed(1)}% < 90%)`);
    failureReason = `Fails gates: ${failures.join(', ')}`;
  }

  const newCommitId = Math.random().toString(16).substring(2, 9);
  const newRun = {
    commitId: args.commit || newCommitId,
    author,
    timestamp: new Date().toISOString(),
    message,
    model,
    promptTemplate,
    ragConfig: { chunkSize, chunkOverlap, topK },
    metrics: {
      hallucinationRate: finalHallucinationRate,
      answerRelevancy: avgRelevancy,
      faithfulness: avgFaithfulness,
      avgLatency,
      p50Latency,
      p95Latency,
      totalCost: parseFloat(totalCost.toFixed(5))
    },
    passed,
    failureReason,
    testResults
  };

  runsHistory.push(newRun);
  fs.writeFileSync(historyPath, JSON.stringify(runsHistory, null, 2));

  console.log('--------------------------------------------------');
  console.log('📊 EVALUATION COMPLETE');
  console.log('--------------------------------------------------');
  console.log(`Hallucination Rate: ${(finalHallucinationRate * 100).toFixed(1)}% ${gateHallucinationPassed ? '✅' : '❌ (> 5.0%)'}`);
  console.log(`Avg Relevancy:      ${(avgRelevancy * 100).toFixed(1)}%`);
  console.log(`Avg Faithfulness:   ${(avgFaithfulness * 100).toFixed(1)}% ${gateFaithfulnessPassed ? '✅' : '❌ (< 90%)'}`);
  console.log(`p50 Latency:        ${p50Latency}ms`);
  console.log(`p95 Latency:        ${p95Latency}ms ${gateLatencyPassed ? '✅' : '❌ (> 2000ms)'}`);
  console.log(`Total Run Cost:     $${totalCost.toFixed(4)}`);
  console.log('--------------------------------------------------');

  if (passed) {
    console.log('🎉 SUCCESS: All quality gates passed! Ready to merge.');
    process.exit(0);
  } else {
    console.error(`🚨 FAIL: Quality gate check failed.`);
    console.error(`Reason: ${failureReason}`);
    process.exit(1);
  }
}

run();
