// Shared scoring logic for the simulated evaluation path and the SLA quality
// gates. Used by both the CLI runner (scripts/eval-runner.ts) and the web
// dashboard (src/hooks/useEvalRuns.ts) so the two never drift apart.

import type { GateResult, RunMetrics, TestResult, TestStatus } from '../types.ts';

const HALLUCINATION_BASE_BY_MODEL: Record<string, number> = {
  'gpt-4o': 0.01,
  'claude-3-5-sonnet': 0.012,
  'gpt-4o-mini': 0.025,
  'gpt-3.5-turbo': 0.06
};

const LATENCY_BASE_BY_MODEL: Record<string, number> = {
  'gpt-4o': 1600,
  'claude-3-5-sonnet': 1100,
  'gpt-4o-mini': 800,
  'gpt-3.5-turbo': 1200
};

const QUALITY_BASE_BY_MODEL: Record<string, { relevancy: number; faithfulness: number }> = {
  'gpt-4o': { relevancy: 0.94, faithfulness: 0.95 },
  'claude-3-5-sonnet': { relevancy: 0.94, faithfulness: 0.95 }
};
const DEFAULT_QUALITY_BASE = { relevancy: 0.88, faithfulness: 0.90 };

const TOKEN_PRICING_BY_MODEL: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
  'gpt-3.5-turbo': { input: 0.0000005, output: 0.0000015 }
};
const DEFAULT_TOKEN_PRICING = { input: 0.000005, output: 0.000015 };

export const SLA_GATES = {
  maxHallucinationRate: 0.05,
  maxP95LatencyMs: 2000,
  minFaithfulness: 0.90
};

export function hasSafetyConstraint(promptTemplate: string): boolean {
  const lower = promptTemplate.toLowerCase();
  return lower.includes('only') || lower.includes('do not know') || lower.includes('rely') || lower.includes('purely');
}

export interface SimulateTestResultInput {
  model: string;
  promptTemplate: string;
  chunkSize: number;
  topK: number;
  itemId: string;
}

export interface SimulatedTestResult {
  latency: number;
  cost: number;
  relevancy: number;
  faithfulness: number;
  isHallucinating: boolean;
  modelOutput: string;
}

// Simulated heuristic scoring for a single test case: correlates hallucination,
// latency, cost, and faithfulness with the model choice and RAG hyperparameters.
export function simulateTestResult({ model, promptTemplate, chunkSize, topK, itemId }: SimulateTestResultInput): SimulatedTestResult {
  const safety = hasSafetyConstraint(promptTemplate);

  let baseHallucination = HALLUCINATION_BASE_BY_MODEL[model] ?? 0.05;
  baseHallucination *= safety ? 0.5 : 1.5;
  if (chunkSize < 200) baseHallucination *= 1.8;

  let baseLatency = LATENCY_BASE_BY_MODEL[model] ?? 1000;
  baseLatency += (topK * 80) + (chunkSize / 10);

  const quality = QUALITY_BASE_BY_MODEL[model] ?? DEFAULT_QUALITY_BASE;
  let baseFaithfulness = quality.faithfulness;
  if (!safety) baseFaithfulness -= 0.06;
  if (chunkSize < 250) baseFaithfulness -= 0.05;

  const isHallucinating = Math.random() < baseHallucination;
  const latency = Math.round(baseLatency + (Math.random() * 400 - 200));

  const pricing = TOKEN_PRICING_BY_MODEL[model] ?? DEFAULT_TOKEN_PRICING;
  const inputTokens = (chunkSize * topK) / 4 + 100;
  const outputTokens = 150;
  const cost = (inputTokens * pricing.input) + (outputTokens * pricing.output);

  const relevancy = Math.min(1.0, Math.max(0.0, quality.relevancy + (Math.random() * 0.1 - 0.05)));
  const faithfulness = Math.min(1.0, Math.max(0.0, baseFaithfulness + (Math.random() * 0.08 - 0.04) - (isHallucinating ? 0.25 : 0)));
  const modelOutput = `Simulated response based on context for query ${itemId}. Verified by automated evaluators.`;

  return { latency, cost, relevancy, faithfulness, isHallucinating, modelOutput };
}

export function buildJudgePrompt(question: string, context: string, modelOutput: string): string {
  return `You are an expert AI evaluator. Assess the following:
[Question]: ${question}
[Context]: ${context}
[Generated Answer]: ${modelOutput}

Grade the Generated Answer on two parameters:
1. Faithfulness (Is the answer strictly derived from the context? 0.0 to 1.0)
2. Relevancy (Does the answer address the question? 0.0 to 1.0)

Output strictly JSON containing: faithfulness, relevancy, and isHallucinating.`;
}

export function testResultStatus({ isHallucinating, latency }: { isHallucinating: boolean; latency: number }): TestStatus {
  return (isHallucinating || latency > 2000) ? 'failed' : 'passed';
}

type AggregatableTestResult = Pick<TestResult, 'latency' | 'cost' | 'relevancy' | 'faithfulness' | 'isHallucinating'>;

// Rolls up per-item test results into the aggregate run metrics.
export function aggregateMetrics(testResults: AggregatableTestResult[]): RunMetrics {
  const n = testResults.length;
  const latencies = testResults.map(r => r.latency).sort((a, b) => a - b);
  const p50Latency = latencies[Math.floor(n * 0.5)] || 0;
  const p95Latency = latencies[Math.floor(n * 0.95)] || 0;
  const avgLatency = Math.round(latencies.reduce((sum, l) => sum + l, 0) / n);
  const totalCost = testResults.reduce((sum, r) => sum + r.cost, 0);
  const avgRelevancy = parseFloat((testResults.reduce((sum, r) => sum + r.relevancy, 0) / n).toFixed(3));
  const avgFaithfulness = parseFloat((testResults.reduce((sum, r) => sum + r.faithfulness, 0) / n).toFixed(3));
  const hallucinationRate = testResults.filter(r => r.isHallucinating).length / n;

  return { hallucinationRate, answerRelevancy: avgRelevancy, faithfulness: avgFaithfulness, avgLatency, p50Latency, p95Latency, totalCost };
}

// Checks aggregate metrics against the CI quality gates and builds the
// human-readable failure reason string used in logs and the run record.
export function evaluateGates(metrics: Pick<RunMetrics, 'hallucinationRate' | 'p95Latency' | 'faithfulness'>): GateResult {
  const gateHallucinationPassed = metrics.hallucinationRate <= SLA_GATES.maxHallucinationRate;
  const gateLatencyPassed = metrics.p95Latency <= SLA_GATES.maxP95LatencyMs;
  const gateFaithfulnessPassed = metrics.faithfulness >= SLA_GATES.minFaithfulness;
  const passed = gateHallucinationPassed && gateLatencyPassed && gateFaithfulnessPassed;

  let failureReason = '';
  if (!passed) {
    const failures: string[] = [];
    if (!gateHallucinationPassed) failures.push(`Hallucination Rate (${(metrics.hallucinationRate * 100).toFixed(1)}% > 5%)`);
    if (!gateLatencyPassed) failures.push(`p95 Latency (${metrics.p95Latency}ms > 2000ms)`);
    if (!gateFaithfulnessPassed) failures.push(`Faithfulness (${(metrics.faithfulness * 100).toFixed(1)}% < 90%)`);
    failureReason = `Fails gates: ${failures.join(', ')}`;
  }

  return { gateHallucinationPassed, gateLatencyPassed, gateFaithfulnessPassed, passed, failureReason };
}
