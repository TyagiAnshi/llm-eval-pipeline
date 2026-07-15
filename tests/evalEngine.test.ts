import { describe, it, expect } from 'vitest';
import { hasSafetyConstraint, testResultStatus, aggregateMetrics, evaluateGates } from '../src/utils/evalEngine.ts';

describe('hasSafetyConstraint', () => {
  it('detects grounding-constraint keywords case-insensitively', () => {
    expect(hasSafetyConstraint('Rely ONLY on the provided context')).toBe(true);
    expect(hasSafetyConstraint('Do not assume, if you do not know say so')).toBe(true);
    expect(hasSafetyConstraint('Answer the question directly')).toBe(false);
  });
});

describe('testResultStatus', () => {
  it('fails on hallucination even if latency is fine', () => {
    expect(testResultStatus({ isHallucinating: true, latency: 500 })).toBe('failed');
  });
  it('fails when latency exceeds 2000ms even without hallucination', () => {
    expect(testResultStatus({ isHallucinating: false, latency: 2500 })).toBe('failed');
  });
  it('passes when neither condition is met', () => {
    expect(testResultStatus({ isHallucinating: false, latency: 500 })).toBe('passed');
  });
});

describe('aggregateMetrics', () => {
  const testResults = [
    { latency: 100, cost: 0.001, relevancy: 0.9, faithfulness: 0.95, isHallucinating: false },
    { latency: 200, cost: 0.002, relevancy: 0.8, faithfulness: 0.85, isHallucinating: true },
    { latency: 300, cost: 0.003, relevancy: 0.95, faithfulness: 0.92, isHallucinating: false }
  ];

  it('computes hallucination rate as a fraction of failing items', () => {
    const metrics = aggregateMetrics(testResults);
    expect(metrics.hallucinationRate).toBeCloseTo(1 / 3);
  });

  it('sums cost and rounds average latency', () => {
    const metrics = aggregateMetrics(testResults);
    expect(metrics.totalCost).toBeCloseTo(0.006);
    expect(metrics.avgLatency).toBe(200);
  });

  it('computes p50/p95 latency from the sorted set', () => {
    const metrics = aggregateMetrics(testResults);
    expect(metrics.p50Latency).toBe(200);
    expect(metrics.p95Latency).toBe(300);
  });
});

describe('evaluateGates', () => {
  it('passes when all SLAs are within bounds', () => {
    const result = evaluateGates({ hallucinationRate: 0.02, p95Latency: 1500, faithfulness: 0.95 });
    expect(result.passed).toBe(true);
    expect(result.failureReason).toBe('');
  });

  it('fails and reports every breached gate', () => {
    const result = evaluateGates({ hallucinationRate: 0.10, p95Latency: 2500, faithfulness: 0.80 });
    expect(result.passed).toBe(false);
    expect(result.gateHallucinationPassed).toBe(false);
    expect(result.gateLatencyPassed).toBe(false);
    expect(result.gateFaithfulnessPassed).toBe(false);
    expect(result.failureReason).toContain('Hallucination Rate');
    expect(result.failureReason).toContain('p95 Latency');
    expect(result.failureReason).toContain('Faithfulness');
  });

  it('fails on a single breached gate without mentioning the others', () => {
    const result = evaluateGates({ hallucinationRate: 0.02, p95Latency: 2500, faithfulness: 0.95 });
    expect(result.passed).toBe(false);
    expect(result.failureReason).toBe('Fails gates: p95 Latency (2500ms > 2000ms)');
  });
});
