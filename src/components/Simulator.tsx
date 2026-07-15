import { useState, useEffect, useRef } from 'react';
import { Sliders, Key, RefreshCw, Play } from 'lucide-react';
import type { ConsoleLogEntry, SimulatorRunConfig } from '../types.ts';

interface SimulatorProps {
  isSimulating: boolean;
  simProgress: number;
  consoleLogs: ConsoleLogEntry[];
  hasServerKey: boolean;
  runEvaluation: (config: SimulatorRunConfig) => void;
}

export default function Simulator({
  isSimulating,
  simProgress,
  consoleLogs,
  hasServerKey,
  runEvaluation
}: SimulatorProps) {
  const [simModel, setSimModel] = useState('gpt-4o-mini');
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [simPrompt, setSimPrompt] = useState(
    'System: Rely ONLY on the provided context to answer the user query. Do not assume or extrapolate.\n\nContext:\n{{context}}\n\nQuestion: {{question}}'
  );
  const [simChunkSize, setSimChunkSize] = useState(400);
  const [simTopK, setSimTopK] = useState(3);
  const [evalSubset, setEvalSubset] = useState(10);
  const [simMessage, setSimMessage] = useState('refactor: optimized prompt instruction for context retrieval');

  const consoleEndRef = useRef<HTMLDivElement>(null);

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
      geminiApiKey: hasServerKey ? '' : geminiApiKey,
      promptTemplate: simPrompt,
      chunkSize: simChunkSize,
      topK: simTopK,
      evalSubset,
      message: simMessage,
      author: 'Anshi Tyagi'
    });
  };

  return (
    <div className="simulator-layout">
      {/* Parameters Panel */}
      <div className="glass-panel config-panel panel-padded">
        <h3 className="panel-title" style={{ fontSize: '1.15rem' }}>
          <Sliders size={20} />
          Pipeline Hyperparameters
        </h3>

        <div className="config-form">
          <div className="form-group">
            <label className="form-label" htmlFor="sim-model">Target Model Engine</label>
            <select id="sim-model" className="form-select" value={simModel} onChange={(e) => setSimModel(e.target.value)}>
              <option value="gpt-4o-mini">gpt-4o-mini (Simulated)</option>
              <option value="gpt-4o">gpt-4o (Simulated)</option>
              <option value="claude-3-5-sonnet">claude-3-5-sonnet (Simulated)</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo (Simulated)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (REAL API - Free Tier)</option>
            </select>
            {simModel !== 'gemini-1.5-flash' && (
              <span className="field-hint warning">
                ⚠️ Simulated path: Metrics computed locally via hyperparameter models.
              </span>
            )}
          </div>

          {simModel === 'gemini-1.5-flash' && (
            <div className="form-group api-key-box">
              <label className="form-label api-key-label" htmlFor="sim-gemini-key">
                <Key size={14} /> Google AI Studio API Key
              </label>
              {hasServerKey ? (
                <div className="api-key-active">
                  🟢 Server API Key is active (configured in environment).
                </div>
              ) : (
                <>
                  <input
                    id="sim-gemini-key"
                    type="password"
                    className="form-input api-key-input"
                    placeholder="AIzaSy..."
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                  />
                  <span className="api-key-hint">
                    Bring Your Own Key Tradeoff: Key is sent securely over the network to your local server at /api/eval and is never stored or exposed directly in client-side queries.
                  </span>
                </>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="sim-prompt">System Evaluation Prompt Template</label>
            <textarea
              id="sim-prompt"
              className="form-textarea"
              value={simPrompt}
              onChange={(e) => setSimPrompt(e.target.value)}
              placeholder="System: You are an AI assistant..."
            />
            <span className="field-hint">
              Use dynamic tags: <code>{"{{context}}"}</code> and <code>{"{{question}}"}</code>
            </span>
          </div>

          <div className="range-inputs">
            <div className="form-group">
              <label className="form-label" htmlFor="sim-chunk-size">RAG Chunk Size</label>
              <input
                id="sim-chunk-size"
                type="number"
                className="form-input"
                value={simChunkSize}
                onChange={(e) => setSimChunkSize(parseInt(e.target.value) || 0)}
                min={100}
                max={2000}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sim-topk">Top-K Docs</label>
              <input
                id="sim-topk"
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
            <label className="form-label" htmlFor="sim-subset">Evaluation Subset (Test count)</label>
            <select id="sim-subset" className="form-select" value={evalSubset} onChange={(e) => setEvalSubset(parseInt(e.target.value))}>
              <option value="5">5 Cases (Fast API Check)</option>
              <option value="10">10 Cases (Recommended for API)</option>
              <option value="25">25 Cases</option>
              <option value="50">50 Cases</option>
              <option value="100">All 100 Cases (Full Audit)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sim-message">Commit Message log</label>
            <input
              id="sim-message"
              type="text"
              className="form-input"
              value={simMessage}
              onChange={(e) => setSimMessage(e.target.value)}
              placeholder="e.g., feat: adjusted top-K parameter"
            />
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={handleRun}
            disabled={isSimulating}
          >
            {isSimulating ? (
              <>
                <RefreshCw size={18} className="animate-spin spin-icon" />
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
          <div className="terminal-status-dots">
            <span className="terminal-status-dot red" />
            <span className="terminal-status-dot amber" />
            <span className="terminal-status-dot green" />
          </div>
          <span className="terminal-title">eval-ci-pipeline-runner.sh</span>
        </div>
        <div className="terminal-content">
          {consoleLogs.length === 0 ? (
            <div className="terminal-idle">
              <span className="terminal-idle-glyph">&gt;_</span>
              Console Idle<br />
              Configure parameters on the left and run a simulation.
            </div>
          ) : (
            consoleLogs.map((log, idx) => (
              <div key={idx} className={`log-line ${log.type}`}>
                <span className="log-time">[{log.time}]</span>
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
