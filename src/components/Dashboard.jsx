import React, { useState } from 'react';
import {
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  Search,
  Eye,
  GitBranch,
  User,
  HelpCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard({ runsHistory, activeRunIdx, setActiveRunIdx, datasetLength }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTestCase, setSelectedTestCase] = useState(null);

  if (runsHistory.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        No evaluation history found. Run a simulation to populate metrics!
      </div>
    );
  }

  const activeRun = runsHistory[activeRunIdx];

  // Helper to format chart data, separating simulated vs real runs statistically
  const chartData = runsHistory.map(run => ({
    commit: run.commitId,
    faithfulnessReal: !run.isSimulated ? Math.round(run.metrics.faithfulness * 100) : null,
    faithfulnessSimulated: run.isSimulated ? Math.round(run.metrics.faithfulness * 100) : null,
    hallucinationReal: !run.isSimulated ? Math.round(run.metrics.hallucinationRate * 100) : null,
    hallucinationSimulated: run.isSimulated ? Math.round(run.metrics.hallucinationRate * 100) : null,
  }));

  // Filter test results of the active run
  const filteredResults = activeRun.testResults.filter(item => {
    const matchesSearch = item.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.question.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getSlaStatusClass = (passed) => passed ? 'status-badge-premium passed' : 'status-badge-premium failed';
  
  // Format model label (simulated vs real)
  const formatModelLabel = (runObj) => {
    if (!runObj.isSimulated) {
      return `${runObj.model} (REAL API)`;
    }
    return `${runObj.model} [SIMULATED]`;
  };

  return (
    <div>
      {/* Active Run Header Banner */}
      <div className="commit-ribbon">
        <div className="commit-desc">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
            <span className="tag-pill" style={{ fontFamily: 'var(--font-mono)' }}>commit {activeRun.commitId}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Model: <strong style={{ color: '#FFF' }}>{formatModelLabel(activeRun)}</strong>
            </span>
          </div>
          <h4>{activeRun.message}</h4>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '0.35rem' }}>
            Author: {activeRun.author} • Run: {new Date(activeRun.timestamp).toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div className={getSlaStatusClass(activeRun.passed)}>
            {activeRun.passed ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {activeRun.passed ? 'Safe to Merge (SLA Passed)' : 'Merge Blocked (SLA Failed)'}
          </div>
          {activeRun.isSimulated && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-warning)', background: 'var(--color-warning-bg)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
              ⚠️ Simulated telemetry data
            </span>
          )}
          {!activeRun.isSimulated && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
              🟢 Real Gemini 1.5 & Judge Telemetry
            </span>
          )}
        </div>
      </div>

      {/* Grid of SLA Gauges */}
      <div className="dashboard-grid">
        <div className="glass-panel kpi-card-premium">
          <div className="kpi-details">
            <span className="kpi-label">Hallucinations</span>
            <span className="kpi-val">{(activeRun.metrics.hallucinationRate * 100).toFixed(1)}%</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>SLA threshold: &le; 5.0%</span>
          </div>
          <svg width="60" height="60" className="gauge-svg">
            <circle cx="30" cy="30" r="24" className="gauge-bg" />
            <circle cx="30" cy="30" r="24" 
              className={`gauge-fill ${activeRun.metrics.hallucinationRate <= 0.05 ? 'success' : 'error'}`}
              strokeDasharray={`${activeRun.metrics.hallucinationRate * 150} 150`}
            />
          </svg>
        </div>

        <div className="glass-panel kpi-card-premium">
          <div className="kpi-details">
            <span className="kpi-label">Faithfulness</span>
            <span className="kpi-val">{(activeRun.metrics.faithfulness * 100).toFixed(1)}%</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>SLA threshold: &gt; 90.0%</span>
          </div>
          <svg width="60" height="60" className="gauge-svg">
            <circle cx="30" cy="30" r="24" className="gauge-bg" />
            <circle cx="30" cy="30" r="24" 
              className={`gauge-fill ${activeRun.metrics.faithfulness >= 0.90 ? 'success' : 'error'}`}
              strokeDasharray={`${activeRun.metrics.faithfulness * 150} 150`}
            />
          </svg>
        </div>

        <div className="glass-panel kpi-card-premium">
          <div className="kpi-details">
            <span className="kpi-label">p95 Latency</span>
            <span className="kpi-val">{activeRun.metrics.p95Latency}ms</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>SLA threshold: &le; 2000ms</span>
          </div>
          <svg width="60" height="60" className="gauge-svg">
            <circle cx="30" cy="30" r="24" className="gauge-bg" />
            <circle cx="30" cy="30" r="24" 
              className={`gauge-fill ${activeRun.metrics.p95Latency <= 2000 ? 'cyan' : 'error'}`}
              strokeDasharray={`${Math.min(1.0, activeRun.metrics.p95Latency / 3000) * 150} 150`}
            />
          </svg>
        </div>

        <div className="glass-panel kpi-card-premium">
          <div className="kpi-details">
            <span className="kpi-label">Total Cost</span>
            <span className="kpi-val">${activeRun.metrics.totalCost.toFixed(4)}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>Evaluated cases: {activeRun.testResults.length}</span>
          </div>
          <svg width="60" height="60" className="gauge-svg">
            <circle cx="30" cy="30" r="24" className="gauge-bg" />
            <circle cx="30" cy="30" r="24" 
              className="gauge-fill cyan"
              strokeDasharray="100 150"
            />
          </svg>
        </div>
      </div>

      {/* Recharts Line Trend Chart */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '1.1rem' }}>
          <TrendingUp size={18} style={{ color: 'var(--accent-indigo)' }} />
          SLA Performance & Quality Trends Across Commits
        </h3>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="commit" stroke="var(--color-text-secondary)" tick={{ fontSize: 10 }} />
              <YAxis stroke="var(--color-text-secondary)" tick={{ fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ background: '#0A0F1D', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '8px' }}
                labelFormatter={(value) => `Commit: ${value}`}
              />
              {/* Statistically isolated paths: solid for real, dashed for simulated */}
              <Line name="Faithfulness (Real API)" type="monotone" dataKey="faithfulnessReal" stroke="var(--color-success)" strokeWidth={2} dot={{ r: 4 }} connectNulls={true} />
              <Line name="Faithfulness (Simulated)" type="monotone" dataKey="faithfulnessSimulated" stroke="var(--color-text-secondary)" strokeDasharray="4 4" strokeWidth={1.5} dot={{ r: 3 }} connectNulls={true} />
              <Line name="Hallucinations (Real API)" type="monotone" dataKey="hallucinationReal" stroke="var(--color-error)" strokeWidth={2} dot={{ r: 4 }} connectNulls={true} />
              <Line name="Hallucinations (Simulated)" type="monotone" dataKey="hallucinationSimulated" stroke="#EF4444" strokeDasharray="4 4" strokeWidth={1.5} dot={{ r: 3 }} connectNulls={true} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Search & Filter Logs Section */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
            <Activity size={18} style={{ color: 'var(--accent-indigo)' }} />
            Active Run Test Logs
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-secondary)' }} />
              <input
                type="text"
                placeholder="Search queries..."
                className="form-input"
                style={{ paddingLeft: '32px', width: '220px', height: '36px' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select className="form-select" style={{ width: '150px', height: '36px' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Domains</option>
              <option value="Customer Support">Customer Support</option>
              <option value="Technical & Coding">Technical & Coding</option>
              <option value="Financial & Data Extraction">Finance & Data</option>
              <option value="Legal & Document Analysis">Legal & Contract</option>
            </select>
            <select className="form-select" style={{ width: '130px', height: '36px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="dataset-table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Test Case ID</th>
                <th>Category</th>
                <th>Question Preview</th>
                <th>Latency</th>
                <th>Faithfulness</th>
                <th>Status</th>
                <th>Audit</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((item) => (
                <tr key={item.id} onClick={() => setSelectedTestCase(item)}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.id}</td>
                  <td><span className="tag-pill">{item.category}</span></td>
                  <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.question}</td>
                  <td>{item.latency}ms</td>
                  <td>{(item.faithfulness * 100).toFixed(0)}%</td>
                  <td>
                    <span style={{
                      color: item.status === 'passed' ? 'var(--color-success)' : 'var(--color-error)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      {item.status === 'passed' ? '● PASSED' : '● FAILED'}
                    </span>
                  </td>
                  <td>
                    <button className="menu-item" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderColor: 'var(--border-color)' }}>
                      <Eye size={12} style={{ marginRight: '0.25rem' }} /> Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Drawer Panel */}
      {selectedTestCase && (
        <>
          <div className="drawer-overlay open" onClick={() => setSelectedTestCase(null)} />
          <div className="drawer-container open">
            <div className="drawer-header">
              <div>
                <span className="tag-pill" style={{ fontFamily: 'var(--font-mono)' }}>{selectedTestCase.id}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '0.5rem' }}>{selectedTestCase.category}</span>
              </div>
              <button className="drawer-close" onClick={() => setSelectedTestCase(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div>
                <h4 className="drawer-section-label">User Query</h4>
                <div className="drawer-content-box">{selectedTestCase.question}</div>
              </div>
              <div>
                <h4 className="drawer-section-label">Reference RAG Context Document</h4>
                <div className="drawer-content-box" style={{ background: 'rgba(99,102,241,0.03)', borderColor: 'rgba(99,102,241,0.1)' }}>
                  {selectedTestCase.reference_context || "Reference context loaded from golden dataset."}
                </div>
              </div>
              <div>
                <h4 className="drawer-section-label">Model Generated Response</h4>
                <div className="drawer-content-box" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{selectedTestCase.modelOutput}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <h4 className="drawer-section-label">Latency Metric</h4>
                  <div className="drawer-content-box" style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}>{selectedTestCase.latency}ms</div>
                </div>
                <div style={{ flex: 1 }}>
                  <h4 className="drawer-section-label">Faithfulness Score</h4>
                  <div className="drawer-content-box" style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold', color: selectedTestCase.faithfulness >= 0.90 ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {(selectedTestCase.faithfulness * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
