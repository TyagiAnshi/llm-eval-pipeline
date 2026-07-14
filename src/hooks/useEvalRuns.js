import { useState, useEffect } from 'react';
import { parseJudgeOutput } from '../utils/judgeParser';

export function useEvalRuns(initialDataset) {
  const [runsHistory, setRunsHistory] = useState([]);
  const [activeRunIdx, setActiveRunIdx] = useState(0);
  const [compareRun1Idx, setCompareRun1Idx] = useState(0);
  const [compareRun2Idx, setCompareRun2Idx] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load history from SQLite proxy API
  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/runs');
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setRunsHistory(data);
        setActiveRunIdx(data.length - 1);
        setCompareRun1Idx(Math.max(0, data.length - 2));
        setCompareRun2Idx(data.length - 1);
      }
    } catch (err) {
      console.error("Failed to load runs history from SQLite backend:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const addLog = (logs, text, type = 'info') => {
    const updated = [...logs, { text, type, time: new Date().toLocaleTimeString() }];
    setConsoleLogs(updated);
    return updated;
  };

  const runEvaluation = async (config) => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimProgress(0);
    
    let currentLogs = [];
    currentLogs = addLog(currentLogs, '🚀 Initiating evaluation pipeline...', 'info');
    currentLogs = addLog(currentLogs, `📦 Commit: "${config.message}" by ${config.author}`, 'info');

    const useRealAPI = config.model === 'gemini-1.5-flash';
    if (useRealAPI && !config.geminiApiKey) {
      addLog(currentLogs, '❌ ERROR: Gemini API Key is required for live evaluations.', 'error');
      setIsSimulating(false);
      return;
    }

    currentLogs = addLog(currentLogs, `⚙️ Config: Model=${config.model} (${useRealAPI ? 'REAL API' : 'SIMULATED'}), ChunkSize=${config.chunkSize}, TopK=${config.topK}`, 'info');

    // Select subset
    const subsetItems = initialDataset.slice(0, config.evalSubset);
    const testResults = [];
    let totalLatency = 0;
    let totalCost = 0;
    let totalRelevancy = 0;
    let totalFaithfulness = 0;
    let hallucinationCount = 0;
    const latencies = [];

    // Loop through benchmark cases
    for (let i = 0; i < subsetItems.length; i++) {
      const item = subsetItems[i];
      let modelOutput = '';
      let latency = 0;
      let cost = 0;
      let faithfulness = 1.0;
      let relevancy = 0.92;
      let isHallucinating = false;

      // Update progress meter
      setSimProgress(Math.round(((i + 1) / subsetItems.length) * 100));

      if (useRealAPI) {
        const startTime = Date.now();
        const promptText = config.promptTemplate
          .replace('{{context}}', item.reference_context)
          .replace('{{question}}', item.question);

        currentLogs = addLog(currentLogs, `🌐 Querying Gemini API for ${item.id}...`, 'info');

        try {
          // Inference Call via Backend Proxy
          const response = await fetch('/api/eval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: promptText,
              clientApiKey: config.geminiApiKey,
              useStructuredSchema: false
            })
          });

          const data = await response.json();

          // FAIL LOUDLY AND VISIBLY ON API FAILURE
          if (!response.ok || data.error) {
            const errMsg = data.error?.message || `HTTP error ${response.status}`;
            addLog(currentLogs, `🚨 LIVE API RUN FAILED LOUDLY AND VISIBLY:`, 'error');
            addLog(currentLogs, `❌ Code ${response.status}: ${errMsg}`, 'error');
            addLog(currentLogs, `Pipeline Aborted at Node ${item.id}.`, 'error');
            setIsSimulating(false);
            return;
          }

          modelOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          latency = Date.now() - startTime;
          currentLogs = addLog(currentLogs, `✅ Received response for ${item.id} (${latency}ms)`, 'success');
        } catch (err) {
          addLog(currentLogs, `🚨 CONNECTION FAILURE EXPOSED LOUDLY: ${err.message}`, 'error');
          setIsSimulating(false);
          return;
        }

        // LLM-as-a-Judge Evaluation (NLI grading via structured schema proxy)
        try {
          currentLogs = addLog(currentLogs, `⚖️ Invoking LLM-as-a-Judge NLI Auditor for ${item.id}...`, 'info');
          
          const judgePrompt = `You are an expert AI evaluator. Assess the following:
[Question]: ${item.question}
[Context]: ${item.reference_context}
[Generated Answer]: ${modelOutput}

Grade the Generated Answer on two parameters:
1. Faithfulness (Is the answer strictly derived from the context? 0.0 to 1.0)
2. Relevancy (Does the answer address the question? 0.0 to 1.0)

Output strictly JSON containing: faithfulness, relevancy, and isHallucinating.`;

          const judgeResponse = await fetch('/api/eval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: judgePrompt,
              clientApiKey: config.geminiApiKey,
              useStructuredSchema: true
            })
          });

          const judgeData = await judgeResponse.json();
          if (!judgeResponse.ok || judgeData.error) {
            const errMsg = judgeData.error?.message || `HTTP error ${judgeResponse.status}`;
            addLog(currentLogs, `🚨 LLM-AS-A-JUDGE CRITICAL AUDIT FAILURE: ${errMsg}`, 'error');
            setIsSimulating(false);
            return;
          }

          const judgeText = judgeData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const parsedJudge = parseJudgeOutput(judgeText);

          faithfulness = parsedJudge.faithfulness;
          relevancy = parsedJudge.relevancy;
          isHallucinating = parsedJudge.isHallucinating;

          totalRelevancy += relevancy;
          currentLogs = addLog(currentLogs, `📊 Audit Grade: Faithfulness=${(faithfulness*100).toFixed(0)}%, Relevancy=${(relevancy*100).toFixed(0)}%`, 'success');
        } catch (err) {
          addLog(currentLogs, `🚨 JUDGE PARSING ERROR EXPOSED: ${err.message}`, 'error');
          setIsSimulating(false);
          return;
        }

        cost = 0;
      } else {
        // Simulation Path (correlated hyperparameters)
        const lowerPrompt = config.promptTemplate.toLowerCase();
        const hasSafetyConstraint = lowerPrompt.includes('only') || lowerPrompt.includes('do not know') || lowerPrompt.includes('rely') || lowerPrompt.includes('purely');
        
        let baseHallucination = 0.05;
        if (config.model === 'gpt-4o') baseHallucination = 0.01;
        else if (config.model === 'claude-3-5-sonnet') baseHallucination = 0.012;
        else if (config.model === 'gpt-4o-mini') baseHallucination = 0.025;
        else if (config.model === 'gpt-3.5-turbo') baseHallucination = 0.06;

        if (hasSafetyConstraint) baseHallucination *= 0.5;
        else baseHallucination *= 1.5;
        if (config.chunkSize < 200) baseHallucination *= 1.8;

        let baseLatency = 1000;
        if (config.model === 'gpt-4o') baseLatency = 1600;
        else if (config.model === 'claude-3-5-sonnet') baseLatency = 1100;
        else if (config.model === 'gpt-4o-mini') baseLatency = 800;
        else if (config.model === 'gpt-3.5-turbo') baseLatency = 1200;
        baseLatency += (config.topK * 80) + (config.chunkSize / 10);

        let baseRelevancy = 0.88;
        let baseFaithfulness = 0.90;
        if (config.model === 'gpt-4o' || config.model === 'claude-3-5-sonnet') {
          baseRelevancy = 0.94;
          baseFaithfulness = 0.95;
        }
        if (!hasSafetyConstraint) baseFaithfulness -= 0.06;
        if (config.chunkSize < 250) baseFaithfulness -= 0.05;

        isHallucinating = Math.random() < baseHallucination;
        latency = Math.round(baseLatency + (Math.random() * 400 - 200));

        const inputTokens = (config.chunkSize * config.topK) / 4 + 100;
        const outputTokens = 150;
        let costPerInputToken = 0.000005;
        let costPerOutputToken = 0.000015;
        if (config.model === 'gpt-4o-mini') {
          costPerInputToken = 0.00000015;
          costPerOutputToken = 0.0000006;
        } else if (config.model === 'gpt-3.5-turbo') {
          costPerInputToken = 0.0000005;
          costPerOutputToken = 0.0000015;
        }
        cost = (inputTokens * costPerInputToken) + (outputTokens * costPerOutputToken);

        faithfulness = Math.min(1.0, Math.max(0.0, baseFaithfulness + (Math.random() * 0.08 - 0.04) - (isHallucinating ? 0.25 : 0)));
        relevancy = Math.min(1.0, Math.max(0.0, baseRelevancy + (Math.random() * 0.1 - 0.05)));
        totalRelevancy += relevancy;
        modelOutput = `[SIMULATED] Verified answer context for query ${item.id}.`;

        await new Promise(r => setTimeout(r, 120));
      }

      latencies.push(latency);
      totalLatency += latency;
      totalCost += cost;
      totalFaithfulness += faithfulness;
      if (isHallucinating) hallucinationCount++;

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
      commitId: newCommitId,
      author: config.author,
      timestamp: new Date().toISOString(),
      message: config.message,
      model: config.model,
      promptTemplate: config.promptTemplate,
      ragConfig: { chunkSize: config.chunkSize, chunkOverlap: 50, topK: config.topK },
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

    currentLogs = addLog(currentLogs, '----------------------------------', 'info');
    currentLogs = addLog(currentLogs, '📊 EVALUATION COMPLETE', 'info');
    currentLogs = addLog(currentLogs, `Hallucination Rate: ${(finalHallucinationRate * 100).toFixed(1)}%`, gateHallucinationPassed ? 'success' : 'error');
    currentLogs = addLog(currentLogs, `Avg Faithfulness:   ${(avgFaithfulness * 100).toFixed(1)}%`, gateFaithfulnessPassed ? 'success' : 'error');
    currentLogs = addLog(currentLogs, `p95 Latency:        ${p95Latency}ms`, gateLatencyPassed ? 'success' : 'error');

    if (passed) {
      currentLogs = addLog(currentLogs, '🎉 SUCCESS: All quality gates passed! Commit ready for merge.', 'success');
    } else {
      currentLogs = addLog(currentLogs, `🚨 FAIL: Quality gate breached. Reason: ${failureReason}`, 'error');
    }

    // Save run details into local SQLite database
    try {
      const response = await fetch('/api/runs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRun)
      });
      if (response.ok) {
        await fetchHistory();
      }
    } catch (err) {
      console.error("Failed to persist run details to SQLite backend database:", err);
    }

    setIsSimulating(false);
  };

  return {
    runsHistory,
    activeRunIdx,
    setActiveRunIdx,
    compareRun1Idx,
    setCompareRun1Idx,
    compareRun2Idx,
    setCompareRun2Idx,
    isSimulating,
    simProgress,
    consoleLogs,
    isLoading,
    runEvaluation
  };
}
