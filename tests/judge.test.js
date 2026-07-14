import { describe, it, expect } from 'vitest';
import { parseJudgeOutput } from '../src/utils/judgeParser.js';

describe('parseJudgeOutput Unit Tests', () => {
  it('correctly parses structured JSON inputs', () => {
    const raw = '{ "faithfulness": 0.95, "relevancy": 0.88, "isHallucinating": false }';
    const result = parseJudgeOutput(raw);
    expect(result.faithfulness).toBe(0.95);
    expect(result.relevancy).toBe(0.88);
    expect(result.isHallucinating).toBe(false);
  });

  it('correctly handles markdown json fencing', () => {
    const raw = '```json\n{ "faithfulness": 0.12, "relevancy": 0.90, "isHallucinating": true }\n```';
    const result = parseJudgeOutput(raw);
    expect(result.faithfulness).toBe(0.12);
    expect(result.relevancy).toBe(0.90);
    expect(result.isHallucinating).toBe(true);
  });

  it('safely handles missing fields by using fallbacks', () => {
    const raw = '{ "relevancy": 0.7 }';
    const result = parseJudgeOutput(raw);
    expect(result.relevancy).toBe(0.7);
    expect(result.faithfulness).toBe(0.0); // fallback value
    expect(result.isHallucinating).toBe(false);
  });

  it('safely handles NaN values by replacing them with 0.0', () => {
    const raw = '{ "faithfulness": "NaN", "relevancy": 0.8 }';
    const result = parseJudgeOutput(raw);
    expect(result.faithfulness).toBe(0.0);
    expect(result.relevancy).toBe(0.8);
  });

  it('handles absolute invalid format gracefully', () => {
    const raw = 'The answer is correct and faithful to the documents.';
    const result = parseJudgeOutput(raw);
    expect(result.faithfulness).toBe(0.0);
    expect(result.relevancy).toBe(0.0);
    expect(result.isHallucinating).toBe(true);
  });

  it('handles empty input gracefully', () => {
    const result = parseJudgeOutput('');
    expect(result.faithfulness).toBe(0.0);
    expect(result.relevancy).toBe(0.0);
    expect(result.isHallucinating).toBe(true);
  });
});
