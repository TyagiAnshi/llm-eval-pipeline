import React from 'react';
import { ArrowRightLeft, Sparkles, CheckCircle, XCircle } from 'lucide-react';

export default function Comparator({
  runsHistory,
  compareRun1Idx,
  setCompareRun1Idx,
  compareRun2Idx,
  setCompareRun2Idx
}) {
  if (runsHistory.length < 2) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Need at least 2 commit runs in history to perform side-by-side comparison audits. Run another simulation!
      </div>
    );
  }

  const runA = runsHistory[compareRun1Idx];
  const runB = runsHistory[compareRun2Idx];

  const calcDiff = (valA, valB, isTime = false, isPercent = false) => {
    const diff = valB - valA;
    if (diff === 0) return { text: 'No change', color: 'var(--color-text-secondary)' };
    
    let isBetter = diff < 0; // standard latency/hallucinations decrease is good
    if (isPercent && !isBetter) {
      // faithfulness/relevancy increase is good
      isBetter = diff > 0;
    }

    const formattedDiff = isPercent 
      ? `${(diff * 100).toFixed(1)}%` 
      : isTime ? `${diff}ms` : `${diff.toFixed(5)}`;
    
    return {
      text: diff > 0 ? `+${formattedDiff}` : `${formattedDiff}`,
      color: isBetter ? 'var(--color-success)' : 'var(--color-error)'
    };
  };

  const getMetricClass = (passed) => passed ? 'status-badge-premium passed' : 'status-badge-premium failed';

  const formatModelLabel = (runObj) => {
    if (!runObj.isSimulated) {
      return `${runObj.model} (REAL API)`;
    }
    return `${runObj.model} [SIMULATED]`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Selector ribbon */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
          <ArrowRightLeft size={18} style={{ color: 'var(--accent-indigo)' }} />
          Dual-Run Commit Audits
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Run A:</span>
            <select className="form-select" style={{ width: '200px' }} value={compareRun1Idx} onChange={(e) => setCompareRun1Idx(parseInt(e.target.value))}>
              {runsHistory.map((run, idx) => (
                <option key={run.commitId} value={idx}>[{run.commitId}] {run.message.substring(0, 20)}...</option>
              ))}
            </select>
          </div>
          <span style={{ color: 'var(--border-color-hover)' }}>VS</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Run B:</span>
            <select className="form-select" style={{ width: '200px' }} value={compareRun2Idx} onChange={(e) => setCompareRun2Idx(parseInt(e.target.value))}>
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
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
              <span className="tag-pill" style={{ fontFamily: 'var(--font-mono)' }}>commit {runA.commitId}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'inline', marginLeft: '0.5rem' }}>{formatModelLabel(runA)}</span>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '0.5rem' }}>{runA.message}</h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
              <div className={getMetricClass(runA.passed)}>
                {runA.passed ? 'PASSED' : 'FAILED'}
              </div>
              <span style={{ fontSize: '0.7rem', color: runA.isSimulated ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 600 }}>
                {runA.isSimulated ? '⚠️ SIMULATED' : '🟢 REAL API'}
              </span>
            </div>
          </div>

          <div className="drawer-content-box" style={{ background: 'rgba(0,0,0,0.2)', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Prompt Template</span>
            <code style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>{runA.promptTemplate}</code>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="compare-metric-row">
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Faithfulness</span>
              <span style={{ fontWeight: 600 }}>{(runA.metrics.faithfulness * 100).toFixed(1)}%</span>
            </div>
            <div className="compare-metric-row">
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Hallucination Rate</span>
              <span style={{ fontWeight: 600 }}>{(runA.metrics.hallucinationRate * 100).toFixed(1)}%</span>
            </div>
            <div className="compare-metric-row">
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>p95 Response Latency</span>
              <span style={{ fontWeight: 600 }}>{runA.metrics.p95Latency}ms</span>
            </div>
            <div className="compare-metric-row">
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>EVAL Cost</span>
              <span style={{ fontWeight: 600 }}>${runA.metrics.totalCost.toFixed(5)}</span>
            </div>
            <div className="compare-metric-row">
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Chunk Size / Top-K</span>
              <span style={{ fontWeight: 600 }}>{runA.ragConfig.chunkSize} / {runA.ragConfig.topK}</span>
            </div>
          </div>
        </div>

        {/* Run B Details */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
              <span className="tag-pill" style={{ fontFamily: 'var(--font-mono)' }}>commit {runB.commitId}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'inline', marginLeft: '0.5rem' }}>{formatModelLabel(runB)}</span>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '0.5rem' }}>{runB.message}</h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
              <div className={getMetricClass(runB.passed)}>
                {runB.passed ? 'PASSED' : 'FAILED'}
              </div>
              <span style={{ fontSize: '0.7rem', color: runB.isSimulated ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 600 }}>
                {runB.isSimulated ? '⚠️ SIMULATED' : '🟢 REAL API'}
              </span>
            </div>
          </div>

          <div className="drawer-content-box" style={{ background: 'rgba(0,0,0,0.2)', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Prompt Template</span>
            <code style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>{runB.promptTemplate}</code>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="compare-metric-row">
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Faithfulness</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>{(runB.metrics.faithfulness * 100).toFixed(1)}%</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: calcDiff(runA.metrics.faithfulness, runB.metrics.faithfulness, false, true).color }}>
                  ({calcDiff(runA.metrics.faithfulness, runB.metrics.faithfulness, false, true).text})
                </span>
              </div>
            </div>
            <div className="compare-metric-row">
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Hallucination Rate</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>{(runB.metrics.hallucinationRate * 100).toFixed(1)}%</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: calcDiff(runA.metrics.hallucinationRate, runB.metrics.hallucinationRate, false, true).color }}>
                  ({calcDiff(runA.metrics.hallucinationRate, runB.metrics.hallucinationRate, false, true).text})
                </span>
              </div>
            </div>
            <div className="compare-metric-row">
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>p95 Response Latency</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>{runB.metrics.p95Latency}ms</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: calcDiff(runA.metrics.p95Latency, runB.metrics.p95Latency, true, false).color }}>
                  ({calcDiff(runA.metrics.p95Latency, runB.metrics.p95Latency, true, false).text})
                </span>
              </div>
            </div>
            <div className="compare-metric-row">
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>EVAL Cost</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>${runB.metrics.totalCost.toFixed(5)}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: calcDiff(runA.metrics.totalCost, runB.metrics.totalCost, false, false).color }}>
                  ({calcDiff(runA.metrics.totalCost, runB.metrics.totalCost, false, false).text})
                </span>
              </div>
            </div>
            <div className="compare-metric-row">
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Chunk Size / Top-K</span>
              <span style={{ fontWeight: 600 }}>{runB.ragConfig.chunkSize} / {runB.ragConfig.topK}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
