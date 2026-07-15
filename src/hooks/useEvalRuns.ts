import { useState, useEffect } from 'react';
import { parseJudgeOutput } from '../utils/judgeParser.ts';
import { simulateTestResult, buildJudgePrompt, testResultStatus, aggregateMetrics, evaluateGates } from '../utils/evalEngine.ts';
import defaultHistory from '../data/runs_history.json';
import type { ConsoleLogEntry, ConsoleLogType, EvalRun, GoldenDatasetItem, SimulatorRunConfig, TestResult } from '../types.ts';

interface GeminiEvalResponse {
  error?: { message?: string };
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export function useEvalRuns(initialDataset: GoldenDatasetItem[]) {
  const [runsHistory, setRunsHistory] = useState<EvalRun[]>([]);
  const [activeRunIdx, setActiveRunIdx] = useState(0);
  const [compareRun1Idx, setCompareRun1Idx] = useState(0);
  const [compareRun2Idx, setCompareRun2Idx] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [hasServerKey, setHasServerKey] = useState(false);

  // Load history and config from SQLite proxy API
  const fetchHistory = async () => {
    try {
      // Load server config
      const configRes = await fetch('/api/config');
      const configData = await configRes.json() as { hasServerKey?: boolean };
      setHasServerKey(!!configData.hasServerKey);

      const response = await fetch('/api/runs');
      const data = await response.json() as EvalRun[];
      if (Array.isArray(data) && data.length > 0) {
        setRunsHistory(data);
        setActiveRunIdx(data.length - 1);
        setCompareRun1Idx(Math.max(0, data.length - 2));
        setCompareRun2Idx(data.length - 1);
      } else {
        throw new Error("No runs found in database.");
      }
    } catch (err) {
      console.warn("Failed to load runs history from SQLite backend. Falling back to local static JSON history:", err);
      // Map default history to match state shape
      const mapped = (defaultHistory as unknown as EvalRun[]).map(run => ({
        ...run,
        isSimulated: run.isSimulated !== false
      }));
      setRunsHistory(mapped);
      setActiveRunIdx(mapped.length - 1);
      setCompareRun1Idx(Math.max(0, mapped.length - 2));
      setCompareRun2Idx(mapped.length - 1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const addLog = (logs: ConsoleLogEntry[], text: string, type: ConsoleLogType = 'info'): ConsoleLogEntry[] => {
    const updated = [...logs, { text, type, time: new Date().toLocaleTimeString() }];
    setConsoleLogs(updated);
    return updated;
  };

  const runEvaluation = async (config: SimulatorRunConfig) => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimProgress(0);

    let currentLogs: ConsoleLogEntry[] = [];
    currentLogs = addLog(currentLogs, '🚀 Initiating evaluation pipeline...', 'info');
    currentLogs = addLog(currentLogs, `📦 Commit: "${config.message}" by ${config.author}`, 'info');

    const useRealAPI = config.model === 'gemini-1.5-flash';
    if (useRealAPI && !config.geminiApiKey && !hasServerKey) {
      addLog(currentLogs, '❌ ERROR: Gemini API Key is required for live evaluations.', 'error');
      setIsSimulating(false);
      return;
    }

    currentLogs = addLog(currentLogs, `⚙️ Config: Model=${config.model} (${useRealAPI ? 'REAL API' : 'SIMULATED'}), ChunkSize=${config.chunkSize}, TopK=${config.topK}`, 'info');

    // Select subset
    const subsetItems = initialDataset.slice(0, config.evalSubset);
    const testResults: TestResult[] = [];

    // Loop through benchmark cases
    for (let i = 0; i < subsetItems.length; i++) {
      const item = subsetItems[i];
      let modelOutput: string;
      let latency: number;
      let cost: number;
      let faithfulness: number;
      let relevancy: number;
      let isHallucinating: boolean;

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

          const data = await response.json() as GeminiEvalResponse;

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
          addLog(currentLogs, `🚨 CONNECTION FAILURE EXPOSED LOUDLY: ${(err as Error).message}`, 'error');
          setIsSimulating(false);
          return;
        }

        // LLM-as-a-Judge Evaluation (NLI grading via structured schema proxy)
        try {
          currentLogs = addLog(currentLogs, `⚖️ Invoking LLM-as-a-Judge NLI Auditor for ${item.id}...`, 'info');

          const judgePrompt = buildJudgePrompt(item.question, item.reference_context, modelOutput);

          const judgeResponse = await fetch('/api/eval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: judgePrompt,
              clientApiKey: hasServerKey ? '' : config.geminiApiKey,
              useStructuredSchema: true
            })
          });

          const judgeData = await judgeResponse.json() as GeminiEvalResponse;
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

          currentLogs = addLog(currentLogs, `📊 Audit Grade: Faithfulness=${(faithfulness*100).toFixed(0)}%, Relevancy=${(relevancy*100).toFixed(0)}%`, 'success');
        } catch (err) {
          addLog(currentLogs, `🚨 JUDGE PARSING ERROR EXPOSED: ${(err as Error).message}`, 'error');
          setIsSimulating(false);
          return;
        }

        cost = 0;
      } else {
        // Simulation Path (correlated hyperparameters, shared with the CLI runner)
        const simulated = simulateTestResult({
          model: config.model,
          promptTemplate: config.promptTemplate,
          chunkSize: config.chunkSize,
          topK: config.topK,
          itemId: item.id
        });
        latency = simulated.latency;
        cost = simulated.cost;
        relevancy = simulated.relevancy;
        faithfulness = simulated.faithfulness;
        isHallucinating = simulated.isHallucinating;
        modelOutput = simulated.modelOutput;

        await new Promise(r => setTimeout(r, 120));
      }

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
    }

    const metrics = aggregateMetrics(testResults);
    const { gateHallucinationPassed, gateLatencyPassed, gateFaithfulnessPassed, passed, failureReason } = evaluateGates(metrics);

    const newCommitId = Math.random().toString(16).substring(2, 9);
    const newRun: EvalRun = {
      commitId: newCommitId,
      author: config.author,
      timestamp: new Date().toISOString(),
      message: config.message,
      model: config.model,
      promptTemplate: config.promptTemplate,
      isSimulated: !useRealAPI,
      ragConfig: { chunkSize: config.chunkSize, chunkOverlap: 50, topK: config.topK },
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

    currentLogs = addLog(currentLogs, '----------------------------------', 'info');
    currentLogs = addLog(currentLogs, '📊 EVALUATION COMPLETE', 'info');
    currentLogs = addLog(currentLogs, `Hallucination Rate: ${(metrics.hallucinationRate * 100).toFixed(1)}%`, gateHallucinationPassed ? 'success' : 'error');
    currentLogs = addLog(currentLogs, `Avg Faithfulness:   ${(metrics.faithfulness * 100).toFixed(1)}%`, gateFaithfulnessPassed ? 'success' : 'error');
    currentLogs = addLog(currentLogs, `p95 Latency:        ${metrics.p95Latency}ms`, gateLatencyPassed ? 'success' : 'error');

    if (passed) {
      addLog(currentLogs, '🎉 SUCCESS: All quality gates passed! Commit ready for merge.', 'success');
    } else {
      addLog(currentLogs, `🚨 FAIL: Quality gate breached. Reason: ${failureReason}`, 'error');
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
    hasServerKey,
    runEvaluation
  };
}
