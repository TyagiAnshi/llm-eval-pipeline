export interface RagConfig {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
}

export type TestStatus = 'passed' | 'failed';

export interface TestResult {
  id: string;
  category: string;
  question: string;
  modelOutput: string;
  latency: number;
  cost: number;
  relevancy: number;
  faithfulness: number;
  isHallucinating: boolean;
  status: TestStatus;
  reference_context?: string;
}

export interface RunMetrics {
  hallucinationRate: number;
  answerRelevancy: number;
  faithfulness: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  totalCost: number;
}

export interface EvalRun {
  commitId: string;
  author: string;
  timestamp: string;
  message: string;
  model: string;
  promptTemplate: string;
  isSimulated: boolean;
  ragConfig: RagConfig;
  metrics: RunMetrics;
  passed: boolean;
  failureReason: string;
  testResults: TestResult[];
}

export interface JudgeResult {
  faithfulness: number;
  relevancy: number;
  isHallucinating: boolean;
}

export interface GateResult {
  gateHallucinationPassed: boolean;
  gateLatencyPassed: boolean;
  gateFaithfulnessPassed: boolean;
  passed: boolean;
  failureReason: string;
}

export interface GoldenDatasetItem {
  id: string;
  category: string;
  question: string;
  expected_answer: string;
  reference_context: string;
}

export type ConsoleLogType = 'info' | 'success' | 'error';

export interface ConsoleLogEntry {
  text: string;
  type: ConsoleLogType;
  time: string;
}

export interface SimulatorRunConfig {
  model: string;
  geminiApiKey: string;
  promptTemplate: string;
  chunkSize: number;
  topK: number;
  evalSubset: number;
  message: string;
  author: string;
}
