import { ArrowRightLeft } from 'lucide-react';
import type { EvalRun } from '../types.ts';

interface ComparatorProps {
  runsHistory: EvalRun[];
  compareRun1Idx: number;
  setCompareRun1Idx: (idx: number) => void;
  compareRun2Idx: number;
  setCompareRun2Idx: (idx: number) => void;
}

interface DiffResult {
  text: string;
  color: string;
}

type DiffFormat = 'percent' | 'time' | 'cost' | '';

export default function Comparator({
  runsHistory,
  compareRun1Idx,
  setCompareRun1Idx,
  compareRun2Idx,
  setCompareRun2Idx
}: ComparatorProps) {
  if (runsHistory.length < 2) {
    return (
      <div className="glass-panel panel-padded-lg">
        Need at least 2 commit runs in history to perform side-by-side comparison audits. Run another simulation!
      </div>
    );
  }

  const runA = runsHistory[compareRun1Idx];
  const runB = runsHistory[compareRun2Idx];

  const calcDiff = (valA: number, valB: number, formatType: DiffFormat = '', isHigherBetter = false): DiffResult => {
    const diff = valB - valA;
    if (diff === 0) return { text: 'No change', color: 'var(--color-text-secondary)' };

    const isBetter = isHigherBetter ? diff > 0 : diff < 0;

    let formattedDiff;
    if (formatType === 'percent') {
      formattedDiff = `${(diff * 100).toFixed(1)}%`;
    } else if (formatType === 'time') {
      formattedDiff = `${diff}ms`;
    } else {
      formattedDiff = `${diff.toFixed(5)}`;
    }

    return {
      text: diff > 0 ? `+${formattedDiff}` : `${formattedDiff}`,
      color: isBetter ? 'var(--color-success)' : 'var(--color-error)'
    };
  };

  const getMetricClass = (passed: boolean) => passed ? 'status-badge-premium passed' : 'status-badge-premium failed';

  const formatModelLabel = (runObj: EvalRun) => {
    if (!runObj.isSimulated) {
      return `${runObj.model} (REAL API)`;
    }
    return `${runObj.model} [SIMULATED]`;
  };

  return (
    <div className="flex-col gap-xl">
      {/* Selector ribbon */}
      <div className="glass-panel selector-ribbon">
        <h3 className="panel-title" style={{ marginBottom: 0 }}>
          <ArrowRightLeft size={18} />
          Dual-Run Commit Audits
        </h3>
        <div className="flex-row gap-lg">
          <div className="run-select-group">
            <label htmlFor="compare-run-a" className="text-sm text-muted">Run A:</label>
            <select
              id="compare-run-a"
              className="form-select select-wide"
              value={compareRun1Idx}
              onChange={(e) => setCompareRun1Idx(parseInt(e.target.value))}
            >
              {runsHistory.map((run, idx) => (
                <option key={run.commitId} value={idx}>[{run.commitId}] {run.message.substring(0, 20)}...</option>
              ))}
            </select>
          </div>
          <span className="vs-label">VS</span>
          <div className="run-select-group">
            <label htmlFor="compare-run-b" className="text-sm text-muted">Run B:</label>
            <select
              id="compare-run-b"
              className="form-select select-wide"
              value={compareRun2Idx}
              onChange={(e) => setCompareRun2Idx(parseInt(e.target.value))}
            >
              {runsHistory.map((run, idx) => (
                <option key={run.commitId} value={idx}>[{run.commitId}] {run.message.substring(0, 20)}...</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main comparative details */}
      <div className="simulator-layout">
        {/* Run A Details */}
        <div className="glass-panel panel-padded">
          <div className="compare-col-header">
            <div>
              <span className="tag-pill text-mono">commit {runA.commitId}</span>
              <span className="text-sm text-muted" style={{ display: 'inline', marginLeft: '0.5rem' }}>{formatModelLabel(runA)}</span>
              <h4 className="compare-col-title">{runA.message}</h4>
            </div>
            <div className="compare-col-meta">
              <div className={getMetricClass(runA.passed)}>
                {runA.passed ? 'PASSED' : 'FAILED'}
              </div>
              <span className={`compare-source-badge ${runA.isSimulated ? 'simulated' : 'real'}`}>
                {runA.isSimulated ? '⚠️ SIMULATED' : '🟢 REAL API'}
              </span>
            </div>
          </div>

          <div className="drawer-content-box prompt-box">
            <span className="prompt-label">Prompt Template</span>
            <code className="prompt-code">{runA.promptTemplate}</code>
          </div>

          <div className="compare-metrics-list">
            <div className="compare-metric-row">
              <span className="text-md text-muted">Faithfulness</span>
              <span className="text-bold">{(runA.metrics.faithfulness * 100).toFixed(1)}%</span>
            </div>
            <div className="compare-metric-row">
              <span className="text-md text-muted">Hallucination Rate</span>
              <span className="text-bold">{(runA.metrics.hallucinationRate * 100).toFixed(1)}%</span>
            </div>
            <div className="compare-metric-row">
              <span className="text-md text-muted">p95 Response Latency</span>
              <span className="text-bold">{runA.metrics.p95Latency}ms</span>
            </div>
            <div className="compare-metric-row">
              <span className="text-md text-muted">EVAL Cost</span>
              <span className="text-bold">${runA.metrics.totalCost.toFixed(5)}</span>
            </div>
            <div className="compare-metric-row">
              <span className="text-md text-muted">Chunk Size / Top-K</span>
              <span className="text-bold">{runA.ragConfig.chunkSize} / {runA.ragConfig.topK}</span>
            </div>
          </div>
        </div>

        {/* Run B Details */}
        <div className="glass-panel panel-padded">
          <div className="compare-col-header">
            <div>
              <span className="tag-pill text-mono">commit {runB.commitId}</span>
              <span className="text-sm text-muted" style={{ display: 'inline', marginLeft: '0.5rem' }}>{formatModelLabel(runB)}</span>
              <h4 className="compare-col-title">{runB.message}</h4>
            </div>
            <div className="compare-col-meta">
              <div className={getMetricClass(runB.passed)}>
                {runB.passed ? 'PASSED' : 'FAILED'}
              </div>
              <span className={`compare-source-badge ${runB.isSimulated ? 'simulated' : 'real'}`}>
                {runB.isSimulated ? '⚠️ SIMULATED' : '🟢 REAL API'}
              </span>
            </div>
          </div>

          <div className="drawer-content-box prompt-box">
            <span className="prompt-label">Prompt Template</span>
            <code className="prompt-code">{runB.promptTemplate}</code>
          </div>

          <div className="compare-metrics-list">
            <div className="compare-metric-row">
              <span className="text-md text-muted">Faithfulness</span>
              <div className="compare-value-row">
                <span className="text-bold">{(runB.metrics.faithfulness * 100).toFixed(1)}%</span>
                <span className="diff-badge" style={{ color: calcDiff(runA.metrics.faithfulness, runB.metrics.faithfulness, 'percent', true).color }}>
                  ({calcDiff(runA.metrics.faithfulness, runB.metrics.faithfulness, 'percent', true).text})
                </span>
              </div>
            </div>
            <div className="compare-metric-row">
              <span className="text-md text-muted">Hallucination Rate</span>
              <div className="compare-value-row">
                <span className="text-bold">{(runB.metrics.hallucinationRate * 100).toFixed(1)}%</span>
                <span className="diff-badge" style={{ color: calcDiff(runA.metrics.hallucinationRate, runB.metrics.hallucinationRate, 'percent', false).color }}>
                  ({calcDiff(runA.metrics.hallucinationRate, runB.metrics.hallucinationRate, 'percent', false).text})
                </span>
              </div>
            </div>
            <div className="compare-metric-row">
              <span className="text-md text-muted">p95 Response Latency</span>
              <div className="compare-value-row">
                <span className="text-bold">{runB.metrics.p95Latency}ms</span>
                <span className="diff-badge" style={{ color: calcDiff(runA.metrics.p95Latency, runB.metrics.p95Latency, 'time', false).color }}>
                  ({calcDiff(runA.metrics.p95Latency, runB.metrics.p95Latency, 'time', false).text})
                </span>
              </div>
            </div>
            <div className="compare-metric-row">
              <span className="text-md text-muted">EVAL Cost</span>
              <div className="compare-value-row">
                <span className="text-bold">${runB.metrics.totalCost.toFixed(5)}</span>
                <span className="diff-badge" style={{ color: calcDiff(runA.metrics.totalCost, runB.metrics.totalCost, 'cost', false).color }}>
                  ({calcDiff(runA.metrics.totalCost, runB.metrics.totalCost, 'cost', false).text})
                </span>
              </div>
            </div>
            <div className="compare-metric-row">
              <span className="text-md text-muted">Chunk Size / Top-K</span>
              <span className="text-bold">{runB.ragConfig.chunkSize} / {runB.ragConfig.topK}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
