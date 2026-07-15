import { useState } from 'react';
import {
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  Search,
  Eye
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { EvalRun, TestResult } from '../types.ts';

interface DashboardProps {
  runsHistory: EvalRun[];
  activeRunIdx: number;
}

export default function Dashboard({ runsHistory, activeRunIdx }: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTestCase, setSelectedTestCase] = useState<TestResult | null>(null);

  if (runsHistory.length === 0) {
    return (
      <div className="glass-panel panel-padded-lg">
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

  const getSlaStatusClass = (passed: boolean) => passed ? 'status-badge-premium passed' : 'status-badge-premium failed';

  // Format model label (simulated vs real)
  const formatModelLabel = (runObj: EvalRun) => {
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
          <div className="flex-row gap-md" style={{ marginBottom: '0.35rem' }}>
            <span className="tag-pill text-mono">commit {activeRun.commitId}</span>
            <span className="text-md text-muted">
              Model: <strong className="text-white">{formatModelLabel(activeRun)}</strong>
            </span>
          </div>
          <h4>{activeRun.message}</h4>
          <span className="text-md text-muted" style={{ display: 'block', marginTop: '0.35rem' }}>
            Author: {activeRun.author} • Run: {new Date(activeRun.timestamp).toLocaleString()}
          </span>
        </div>
        <div className="flex-col items-end gap-sm">
          <div className={getSlaStatusClass(activeRun.passed)}>
            {activeRun.passed ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {activeRun.passed ? 'Safe to Merge (SLA Passed)' : 'Merge Blocked (SLA Failed)'}
          </div>
          {activeRun.isSimulated && (
            <span className="badge-inline badge-warning">
              ⚠️ Simulated telemetry data
            </span>
          )}
          {!activeRun.isSimulated && (
            <span className="badge-inline badge-success">
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
            <span className="text-xs text-muted">SLA threshold: &le; 5.0%</span>
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
            <span className="text-xs text-muted">SLA threshold: &gt; 90.0%</span>
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
            <span className="text-xs text-muted">SLA threshold: &le; 2000ms</span>
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
            <span className="text-xs text-muted">Evaluated cases: {activeRun.testResults.length}</span>
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
      <div className="glass-panel panel-padded panel-mb">
        <h3 className="panel-title">
          <TrendingUp size={18} />
          SLA Performance & Quality Trends Across Commits
        </h3>
        <div className="chart-wrap">
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
      <div className="glass-panel panel-padded">
        <div className="flex-row justify-between flex-wrap gap-lg" style={{ marginBottom: '1.5rem' }}>
          <h3 className="flex-row gap-sm" style={{ fontSize: '1.1rem' }}>
            <Activity size={18} style={{ color: 'var(--accent-indigo)' }} />
            Active Run Test Logs
          </h3>
          <div className="flex-row gap-md flex-wrap">
            <div className="search-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search queries..."
                aria-label="Search test queries"
                className="form-input search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="form-select select-sm"
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Domains</option>
              <option value="Customer Support">Customer Support</option>
              <option value="Technical & Coding">Technical & Coding</option>
              <option value="Financial & Data Extraction">Finance & Data</option>
              <option value="Legal & Document Analysis">Legal & Contract</option>
            </select>
            <select
              className="form-select select-xs"
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
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
                  <td className="text-mono text-bold">{item.id}</td>
                  <td><span className="tag-pill">{item.category}</span></td>
                  <td className="truncate-ellipsis">{item.question}</td>
                  <td>{item.latency}ms</td>
                  <td>{(item.faithfulness * 100).toFixed(0)}%</td>
                  <td>
                    <span className={`status-text ${item.status}`}>
                      {item.status === 'passed' ? '● PASSED' : '● FAILED'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="menu-item inspect-btn" aria-label={`Inspect test case ${item.id}`}>
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
          <div
            className="drawer-overlay open"
            onClick={() => setSelectedTestCase(null)}
            role="presentation"
          />
          <div className="drawer-container open" role="dialog" aria-modal="true" aria-label={`Test case details for ${selectedTestCase.id}`}>
            <div className="drawer-header">
              <div>
                <span className="tag-pill text-mono">{selectedTestCase.id}</span>
                <span className="text-sm text-muted" style={{ marginLeft: '0.5rem' }}>{selectedTestCase.category}</span>
              </div>
              <button type="button" className="drawer-close" aria-label="Close details drawer" onClick={() => setSelectedTestCase(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div>
                <h4 className="drawer-section-label">User Query</h4>
                <div className="drawer-content-box">{selectedTestCase.question}</div>
              </div>
              <div>
                <h4 className="drawer-section-label">Reference RAG Context Document</h4>
                <div className="drawer-content-box tinted">
                  {selectedTestCase.reference_context || "Reference context loaded from golden dataset."}
                </div>
              </div>
              <div>
                <h4 className="drawer-section-label">Model Generated Response</h4>
                <div className="drawer-content-box text-mono text-md">{selectedTestCase.modelOutput}</div>
              </div>
              <div className="drawer-metric-row">
                <div className="drawer-metric-col">
                  <h4 className="drawer-section-label">Latency Metric</h4>
                  <div className="drawer-content-box metric-box-center">{selectedTestCase.latency}ms</div>
                </div>
                <div className="drawer-metric-col">
                  <h4 className="drawer-section-label">Faithfulness Score</h4>
                  <div className={`drawer-content-box metric-box-center ${selectedTestCase.faithfulness >= 0.90 ? 'passed' : 'failed'}`}>
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
