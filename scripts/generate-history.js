import fs from 'fs';
import path from 'path';

// Read golden dataset to reference it
const goldenDataset = JSON.parse(fs.readFileSync('src/data/golden_dataset.json', 'utf8'));

const commits = [
  {
    commitId: 'b9a4c12',
    author: 'Alice Chen',
    timestamp: '2026-07-10T10:15:00Z',
    message: 'Initial release: simple GPT-3.5-turbo RAG system',
    model: 'gpt-3.5-turbo',
    promptTemplate: 'Answer the user query: {{question}} using context: {{context}}',
    ragConfig: { chunkSize: 1000, chunkOverlap: 200, topK: 3 },
    metrics: {
      hallucinationRate: 0.08, // 8% - fails gate!
      answerRelevancy: 0.82,
      faithfulness: 0.84,
      avgLatency: 1450,
      p50Latency: 1200,
      p95Latency: 2200, // Fails SLA
      totalCost: 0.0125
    },
    passed: false,
    failureReason: 'Hallucination rate exceeds 5%, p95 latency exceeds 2000ms'
  },
  {
    commitId: 'f2c7d54',
    author: 'Bob Smith',
    timestamp: '2026-07-11T14:30:00Z',
    message: 'Optimized RAG chunking and added prompt constraints',
    model: 'gpt-3.5-turbo',
    promptTemplate: 'You are a helpful assistant. Rely ONLY on the context below to answer. If not mentioned in context, say you do not know.\n\nContext:\n{{context}}\n\nQuestion: {{question}}',
    ragConfig: { chunkSize: 500, chunkOverlap: 100, topK: 4 },
    metrics: {
      hallucinationRate: 0.045, // 4.5% - passes hallucination gate
      answerRelevancy: 0.86,
      faithfulness: 0.89,
      avgLatency: 1650,
      p50Latency: 1400,
      p95Latency: 2450, // Still fails latency SLA due to topK=4 sending more tokens
      totalCost: 0.0142
    },
    passed: false,
    failureReason: 'p95 latency exceeds 2000ms'
  },
  {
    commitId: 'a4e8d21',
    author: 'Alice Chen',
    timestamp: '2026-07-12T09:05:00Z',
    message: 'Swapped model to gpt-4o-mini, optimized prompt structure',
    model: 'gpt-4o-mini',
    promptTemplate: 'System: Use the provided documentation to answer the question faithfully.\n\nDoc:\n{{context}}\n\nQuestion:\n{{question}}',
    ragConfig: { chunkSize: 400, chunkOverlap: 50, topK: 3 },
    metrics: {
      hallucinationRate: 0.035,
      answerRelevancy: 0.89,
      faithfulness: 0.92,
      avgLatency: 950,
      p50Latency: 820,
      p95Latency: 1480, // Passes SLA!
      totalCost: 0.0035 // Cost reduced significantly
    },
    passed: true,
    failureReason: ''
  },
  {
    commitId: 'e8b9f10',
    author: 'Charlie Patel',
    timestamp: '2026-07-13T11:20:00Z',
    message: 'Feature: Swapped to gpt-4o for max accuracy',
    model: 'gpt-4o',
    promptTemplate: 'System: You are an expert Q&A system. Extract answers purely from Context. Context: {{context}}. Question: {{question}}',
    ragConfig: { chunkSize: 400, chunkOverlap: 50, topK: 3 },
    metrics: {
      hallucinationRate: 0.012, // 1.2% - excellent!
      answerRelevancy: 0.95,
      faithfulness: 0.97,
      avgLatency: 1850,
      p50Latency: 1600,
      p95Latency: 2850, // Fails SLA due to larger model latency
      totalCost: 0.0245 // Fails cost check
    },
    passed: false,
    failureReason: 'p95 latency exceeds 2000ms'
  },
  {
    commitId: '7d3a5e9',
    author: 'Anshi Tyagi',
    timestamp: '2026-07-13T18:45:00Z',
    message: 'Swapped to Claude 3.5 Sonnet, enabled streaming & latency caching',
    model: 'claude-3-5-sonnet',
    promptTemplate: 'Rely only on this context:\n{{context}}\n\nAnswer this: {{question}}',
    ragConfig: { chunkSize: 350, chunkOverlap: 40, topK: 2 },
    metrics: {
      hallucinationRate: 0.015,
      answerRelevancy: 0.96,
      faithfulness: 0.98,
      avgLatency: 1100,
      p50Latency: 950,
      p95Latency: 1750, // Passes SLA!
      totalCost: 0.0185
    },
    passed: true,
    failureReason: ''
  }
];

// Enrich each commit with simulated test results for all 100 items
const runsHistory = commits.map((commit, cIdx) => {
  // Let's seed random behaviors per commit index to make evaluations realistic
  const testResults = goldenDataset.map((item, index) => {
    // Deterministic simulation based on index & commit properties
    let status = 'passed';
    let latency = 500 + (index % 10) * 100 + (commit.metrics.avgLatency - 1000);
    if (latency < 100) latency = 120;
    
    // Simulate some failures
    let isHallucinating = false;
    let relevancy = 0.8 + ((index % 5) * 0.04) + (commit.metrics.answerRelevancy - 0.8);
    if (relevancy > 1) relevancy = 1.0;

    let faithfulness = 0.82 + ((index % 6) * 0.03) + (commit.metrics.faithfulness - 0.85);
    if (faithfulness > 1) faithfulness = 1.0;

    // Simulate hallucination on specific indices for worse models
    if (commit.metrics.hallucinationRate > 0.05 && index % 12 === 0) {
      isHallucinating = true;
      status = 'failed';
    }
    if (latency > 2000 && index % 15 === 0) {
      status = 'failed';
    }

    return {
      id: item.id,
      category: item.category,
      question: item.question,
      modelOutput: `Simulated answer for ${item.id} using ${commit.model}. ${isHallucinating ? 'Additionally, some hallucinated detail not present in context.' : 'Grounded fully on reference context.'}`,
      latency,
      cost: commit.model === 'gpt-4o' ? 0.0003 : (commit.model === 'gpt-4o-mini' ? 0.00004 : 0.00015),
      relevancy,
      faithfulness,
      isHallucinating,
      status
    };
  });

  return {
    ...commit,
    testResults
  };
});

fs.writeFileSync('src/data/runs_history.json', JSON.stringify(runsHistory, null, 2));
console.log(`Generated default runs history at src/data/runs_history.json`);
