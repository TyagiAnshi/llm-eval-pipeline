import React, { useState, useEffect, useRef } from 'react';
import { Sliders, Key, RefreshCw, Play } from 'lucide-react';

export default function Simulator({
  runsHistory,
  isSimulating,
  simProgress,
  consoleLogs,
  runEvaluation
}) {
  const [simModel, setSimModel] = useState('gpt-4o-mini');
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [simPrompt, setSimPrompt] = useState(
    'System: Rely ONLY on the provided context to answer the user query. Do not assume or extrapolate.\n\nContext:\n{{context}}\n\nQuestion: {{question}}'
  );
  const [simChunkSize, setSimChunkSize] = useState(400);
  const [simTopK, setSimTopK] = useState(3);
  const [evalSubset, setEvalSubset] = useState(10);
  const [simMessage, setSimMessage] = useState('refactor: optimized prompt instruction for context retrieval');

  const consoleEndRef = useRef(null);

  // Auto-scroll console terminal to bottom
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs]);

  // Persist API key locally
  useEffect(() => {
    localStorage.setItem('gemini_api_key', geminiApiKey);
  }, [geminiApiKey]);

  const handleRun = () => {
    runEvaluation({
      model: simModel,
      geminiApiKey,
      promptTemplate: simPrompt,
      chunkSize: simChunkSize,
      topK: simTopK,
      evalSubset,
      message: simMessage,
      author: 'Anshi Tyagi'
    });
  };

  const getLogColorClass = (type) => {
    if (type === 'success') return 'text-green-400';
    if (type === 'error') return 'text-red-400';
    return 'text-slate-300';
  };

  return (
    <div className="simulator-layout">
      {/* Parameters Panel */}
      <div className="glass-panel config-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.15rem' }}>
          <Sliders size={20} style={{ color: 'var(--accent-indigo)' }} />
          Pipeline Hyperparameters
        </h3>

        <div className="config-form">
          <div className="form-group">
            <label className="form-label">Target Model Engine</label>
            <select className="form-select" value={simModel} onChange={(e) => setSimModel(e.target.value)}>
              <option value="gpt-4o-mini">gpt-4o-mini (Simulated)</option>
              <option value="gpt-4o">gpt-4o (Simulated)</option>
              <option value="claude-3-5-sonnet">claude-3-5-sonnet (Simulated)</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo (Simulated)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (REAL API - Free Tier)</option>
            </select>
            {simModel !== 'gemini-1.5-flash' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-warning)', marginTop: '0.2rem', display: 'block' }}>
                ⚠️ Simulated path: Metrics computed locally via hyperparameter models.
              </span>
            )}
          </div>

          {simModel === 'gemini-1.5-flash' && (
            <div className="form-group" style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed var(--accent-indigo)' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-cyan)' }}>
                <Key size={14} /> Google AI Studio API Key
              </label>
              <input
                type="password"
                className="form-input"
                style={{ background: 'rgba(0,0,0,0.6)', borderColor: 'var(--accent-indigo)' }}
                placeholder="AIzaSy..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                Stored strictly locally. Real API calls proxy securely via backend Node middleware.
              </span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">System Evaluation Prompt Template</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: '120px' }}
              value={simPrompt}
              onChange={(e) => setSimPrompt(e.target.value)}
              placeholder="System: You are an AI assistant..."
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Use dynamic tags: <code>{"{{context}}"}</code> and <code>{"{{question}}"}</code>
            </span>
          </div>

          <div className="range-inputs">
            <div className="form-group">
              <label className="form-label">RAG Chunk Size</label>
              <input
                type="number"
                className="form-input"
                value={simChunkSize}
                onChange={(e) => setSimChunkSize(parseInt(e.target.value) || 0)}
                min={100}
                max={2000}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Top-K Docs</label>
              <input
                type="number"
                className="form-input"
                value={simTopK}
                onChange={(e) => setSimTopK(parseInt(e.target.value) || 0)}
                min={1}
                max={10}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Evaluation Subset (Test count)</label>
            <select className="form-select" value={evalSubset} onChange={(e) => setEvalSubset(parseInt(e.target.value))}>
              <option value="5">5 Cases (Fast API Check)</option>
              <option value="10">10 Cases (Recommended for API)</option>
              <option value="25">25 Cases</option>
              <option value="50">50 Cases</option>
              <option value="100">All 100 Cases (Full Audit)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Commit Message log</label>
            <input
              type="text"
              className="form-input"
              value={simMessage}
              onChange={(e) => setSimMessage(e.target.value)}
              placeholder="e.g., feat: adjusted top-K parameter"
            />
          </div>

          <button
            className="btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={handleRun}
            disabled={isSimulating}
          >
            {isSimulating ? (
              <>
                <RefreshCw size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                Auditing Benchmark Set ({simProgress}%)
              </>
            ) : (
              <>
                <Play size={18} />
                Commit Change & Run Pipeline
              </>
            )}
          </button>
        </div>
      </div>

      {/* Retro Scrolling Console Output */}
      <div className="terminal-window-premium">
        <div className="terminal-header">
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>eval-ci-pipeline-runner.sh</span>
        </div>
        <div className="terminal-content">
          {consoleLogs.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#475569' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>&gt;_</span>
              Console Idle<br />
              Configure parameters on the left and run a simulation.
            </div>
          ) : (
            consoleLogs.map((log, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.75rem' }} className={getLogColorClass(log.type)}>
                <span style={{ color: '#475569' }}>[{log.time}]</span>
                <span>{log.text}</span>
              </div>
            ))
          )}
          <div ref={consoleEndRef} />
        </div>
      </div>
    </div>
  );
}
