import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Activity,
  Play,
  Layers,
  Database,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  User,
  GitBranch,
  Terminal,
  FileCode,
  Sliders,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Search,
  Eye,
  Key,
  Layers3
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

import defaultGoldenDataset from './data/golden_dataset.json';
import defaultRunsHistory from './data/runs_history.json';

// Premium Radial Progress Gauge Component
function RadialGauge({ value, max = 100, color = 'cyan', size = 56, label }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(value, max) / max) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} className="gauge-svg">
        <circle className="gauge-bg" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className={`gauge-fill ${color}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <span style={{ position: 'absolute', fontSize: '0.75rem', fontWeight: '700', fontFamily: 'var(--font-display)' }}>
        {label || `${Math.round(value)}%`}
      </span>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [goldenDataset, setGoldenDataset] = useState(defaultGoldenDataset);
  const [runsHistory, setRunsHistory] = useState(defaultRunsHistory);
  const [activeRunIndex, setActiveRunIndex] = useState(defaultRunsHistory.length - 1);
  
  // Search & Filters for dashboard test runs
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Drawer / Side Inspector State
  const [selectedTestCase, setSelectedTestCase] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Comparison state
  const [compareRun1Idx, setCompareRun1Idx] = useState(defaultRunsHistory.length - 2);
  const [compareRun2Idx, setCompareRun2Idx] = useState(defaultRunsHistory.length - 1);

  // Gemini API Key (safely persistent in local storage)
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  
  // Simulator Form State
  const [simModel, setSimModel] = useState('gpt-4o-mini');
  const [simPrompt, setSimPrompt] = useState('System: Rely ONLY on the provided context to answer the user query. Do not assume or extrapolate.\n\nContext:\n{{context}}\n\nQuestion: {{question}}');
  const [simChunkSize, setSimChunkSize] = useState(400);
  const [simChunkOverlap, setSimChunkOverlap] = useState(50);
  const [simTopK, setSimTopK] = useState(3);
  const [simMessage, setSimMessage] = useState('refactor: optimized prompt instruction for context retrieval');
  const [simAuthor, setSimAuthor] = useState('Anshi Tyagi');
  const [evalSubset, setEvalSubset] = useState(10); // Default to 10 for quick API runs (avoids rate limits)

  // Simulator Console State
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);

  const activeRun = runsHistory[activeRunIndex] || runsHistory[runsHistory.length - 1];

  // Save API key
  useEffect(() => {
    localStorage.setItem('gemini_api_key', geminiApiKey);
  }, [geminiApiKey]);

  // Open TestCase Inspector Drawer
  const inspectTestCase = (testCase) => {
    setSelectedTestCase(testCase);
    setIsDrawerOpen(true);
  };

  // Close TestCase Inspector Drawer
  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedTestCase(null);
  };

  // Helper to format timestamps
  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Run CI / Commit Simulator
  const runSimulator = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setConsoleLogs([]);
    setSimProgress(0);

    const logs = [];
    const addLog = (text, type = 'info') => {
      logs.push({ text, type, time: new Date().toLocaleTimeString() });
      setConsoleLogs([...logs]);
    };

    addLog('🚀 Initiating automated build pipeline check...', 'info');
    addLog(`📦 Git Commit: "${simMessage}" by ${simAuthor}`, 'info');

    // Basic API validation
    const useRealAPI = simModel === 'gemini-1.5-flash';
    if (useRealAPI && !geminiApiKey) {
      addLog('❌ ERROR: Google Gemini API Key is required for live evaluations. Please input it in the configuration panel.', 'error');
      setIsSimulating(false);
      return;
    }

    setTimeout(() => {
      addLog('🔧 Initializing environment & installing dependencies...', 'info');
      addLog(`📋 Loading Benchmark Dataset (evaluating subset of ${evalSubset} cases)...`, 'info');
    }, 400);

    setTimeout(() => {
      addLog(`🤖 Invoking ${useRealAPI ? 'Google Gemini API' : 'Simulated'} Eval runner...`, 'info');
      addLog(`⚙️ Config: Model=${simModel}, ChunkSize=${simChunkSize}, TopK=${simTopK}`, 'info');
    }, 800);

    // Wait a bit for logs
    await new Promise(r => setTimeout(r, 1200));

    const testResults = [];
    let totalLatency = 0;
    let totalCost = 0;
    let totalRelevancy = 0;
    let totalFaithfulness = 0;
    let hallucinationCount = 0;
    const latencies = [];

    // Select subset
    const subsetItems = goldenDataset.slice(0, evalSubset);

    for (let i = 0; i < subsetItems.length; i++) {
      const item = subsetItems[i];
      let modelOutput = '';
      let latency = 0;
      let cost = 0;
      let faithfulness = 1.0;
      let isHallucinating = false;

      if (useRealAPI) {
        const startTime = Date.now();
        try {
          const promptText = simPrompt
            .replace('{{context}}', item.reference_context)
            .replace('{{question}}', item.question);

          addLog(`🌐 Sending API Query for ${item.id}...`, 'info');

          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }]
            })
          });

          const data = await response.json();
          modelOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "No output returned.";
          latency = Date.now() - startTime;

          // Simple dynamic evaluation logic for real API outputs:
          // 1. Relevancy: match semantic content words
          const outputWords = modelOutput.toLowerCase().split(/\s+/);
          const expectedWords = item.expected_answer.toLowerCase().split(/\s+/);
          const matchedWords = expectedWords.filter(w => w.length > 4 && outputWords.includes(w));
          const relevancy = matchedWords.length / expectedWords.filter(w => w.length > 4).length || 0.85;

          // 2. Faithfulness check: check if output is fully supported by reference context
          // Heuristic: check if nouns in model output match context
          const contextWords = item.reference_context.toLowerCase();
          const uniqueOutputNouns = Array.from(new Set(outputWords.filter(w => w.length > 5)));
          const supportedNouns = uniqueOutputNouns.filter(noun => contextWords.includes(noun));
          
          faithfulness = uniqueOutputNouns.length > 0 ? (supportedNouns.length / uniqueOutputNouns.length) : 1.0;
          if (faithfulness < 0.80) {
            isHallucinating = true;
          }

          // Cost: Gemini 1.5 Flash Free Tier is $0
          cost = 0;

          addLog(`✅ API Response received for ${item.id} (${latency}ms)`, 'success');
        } catch (err) {
          addLog(`❌ API Fetch failed for ${item.id}: ${err.message}`, 'error');
          modelOutput = "Fetch error.";
          latency = 1000;
          faithfulness = 0.5;
          isHallucinating = true;
        }
      } else {
        // Simulated local runner logic
        const lowerPrompt = simPrompt.toLowerCase();
        const hasSafetyConstraint = lowerPrompt.includes('only') || lowerPrompt.includes('do not know') || lowerPrompt.includes('rely') || lowerPrompt.includes('purely');
        
        let baseHallucination = 0.05;
        if (simModel === 'gpt-4o') baseHallucination = 0.01;
        else if (simModel === 'claude-3-5-sonnet') baseHallucination = 0.012;
        else if (simModel === 'gpt-4o-mini') baseHallucination = 0.025;
        else if (simModel === 'gpt-3.5-turbo') baseHallucination = 0.06;

        if (hasSafetyConstraint) baseHallucination *= 0.5;
        else baseHallucination *= 1.5;
        if (simChunkSize < 200) baseHallucination *= 1.8;

        let baseLatency = 1000;
        if (simModel === 'gpt-4o') baseLatency = 1600;
        else if (simModel === 'claude-3-5-sonnet') baseLatency = 1100;
        else if (simModel === 'gpt-4o-mini') baseLatency = 800;
        else if (simModel === 'gpt-3.5-turbo') baseLatency = 1200;
        baseLatency += (simTopK * 80) + (simChunkSize / 10);

        let baseRelevancy = 0.88;
        let baseFaithfulness = 0.90;
        if (simModel === 'gpt-4o' || simModel === 'claude-3-5-sonnet') {
          baseRelevancy = 0.94;
          baseFaithfulness = 0.95;
        }
        if (!hasSafetyConstraint) baseFaithfulness -= 0.06;
        if (simChunkSize < 250) baseFaithfulness -= 0.05;

        isHallucinating = Math.random() < baseHallucination;
        latency = Math.round(baseLatency + (Math.random() * 400 - 200));
        
        const inputTokens = (simChunkSize * simTopK) / 4 + 100;
        const outputTokens = 150;
        let costPerInputToken = 0.000005;
        let costPerOutputToken = 0.000015;
        if (simModel === 'gpt-4o-mini') {
          costPerInputToken = 0.00000015;
          costPerOutputToken = 0.0000006;
        } else if (simModel === 'gpt-3.5-turbo') {
          costPerInputToken = 0.0000005;
          costPerOutputToken = 0.0000015;
        }
        cost = (inputTokens * costPerInputToken) + (outputTokens * costPerOutputToken);

        faithfulness = Math.min(1.0, Math.max(0.0, baseFaithfulness + (Math.random() * 0.08 - 0.04) - (isHallucinating ? 0.25 : 0)));
        modelOutput = `Simulated response based on context for query ${item.id}. Verified by automated evaluators.`;
      }

      latencies.push(latency);
      totalLatency += latency;
      totalCost += cost;
      totalRelevancy += useRealAPI ? (1.0) : 0.92; // default simulated relevancy
      totalFaithfulness += faithfulness;
      if (isHallucinating) hallucinationCount++;

      testResults.push({
        id: item.id,
        category: item.category,
        question: item.question,
        modelOutput,
        latency,
        cost,
        relevancy: useRealAPI ? 0.92 : 0.92,
        faithfulness,
        isHallucinating,
        status: (isHallucinating || latency > 2000) ? 'failed' : 'passed'
      });

      // Update progress bar
      const progressPercent = Math.round(((i + 1) / subsetItems.length) * 100);
      setSimProgress(progressPercent);
      addLog(`✨ Processed ${i + 1}/${subsetItems.length} evaluation cases...`, 'info');

      // Rate limit delay if using Gemini API (1.5 seconds)
      if (useRealAPI && i < subsetItems.length - 1) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }

    latencies.sort((a, b) => a - b);
    const p50Latency = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const finalHallucinationRate = hallucinationCount / subsetItems.length;
    const avgLatency = Math.round(totalLatency / subsetItems.length);
    const avgRelevancy = parseFloat((totalRelevancy / subsetItems.length).toFixed(3));
    const avgFaithfulness = parseFloat((totalFaithfulness / subsetItems.length).toFixed(3));

    const gateHallucinationPassed = finalHallucinationRate <= 0.05;
    const gateLatencyPassed = p95Latency <= 2000;
    const gateFaithfulnessPassed = avgFaithfulness >= 0.90;
    const passed = gateHallucinationPassed && gateLatencyPassed && gateFaithfulnessPassed;

    let failureReason = '';
    if (!passed) {
      const failures = [];
      if (!gateHallucinationPassed) failures.push(`Hallucination Rate (${(finalHallucinationRate * 100).toFixed(1)}% > 5%)`);
      if (!gateLatencyPassed) failures.push(`p95 Latency (${p95Latency}ms > 2000ms)`);
      if (!gateFaithfulnessPassed) failures.push(`Faithfulness (${(avgFaithfulness * 100).toFixed(1)}% < 90%)`);
      failureReason = `Fails gates: ${failures.join(', ')}`;
    }

    const newCommitId = Math.random().toString(16).substring(2, 9);
    const newRunObj = {
      commitId: newCommitId,
      author: simAuthor,
      timestamp: new Date().toISOString(),
      message: simMessage,
      model: simModel,
      promptTemplate: simPrompt,
      ragConfig: { chunkSize: simChunkSize, chunkOverlap: simChunkOverlap, topK: simTopK },
      metrics: {
        hallucinationRate: finalHallucinationRate,
        answerRelevancy: avgRelevancy,
        faithfulness: avgFaithfulness,
        avgLatency,
        p50Latency,
        p95Latency,
        totalCost: parseFloat(totalCost.toFixed(5))
      },
      passed,
      failureReason,
      testResults
    };

    addLog('--------------------------------------------------', 'info');
    addLog(`📊 Evaluation Metrics computed:`, 'info');
    addLog(`  Hallucination Rate: ${(finalHallucinationRate * 100).toFixed(1)}% ${gateHallucinationPassed ? '✅' : '❌ (> 5%)'}`, gateHallucinationPassed ? 'success' : 'error');
    addLog(`  p95 Latency: ${p95Latency}ms ${gateLatencyPassed ? '✅' : '❌ (> 2000ms)'}`, gateLatencyPassed ? 'success' : 'error');
    addLog(`  Faithfulness: ${(avgFaithfulness * 100).toFixed(1)}% ${gateFaithfulnessPassed ? '✅' : '❌ (< 90%)'}`, gateFaithfulnessPassed ? 'success' : 'error');
    addLog(`  Total Cost: $${totalCost.toFixed(4)}`, 'info');
    addLog('--------------------------------------------------', 'info');

    if (passed) {
      addLog('🎉 PIPELINE SUCCESS: All quality gates passed! Commit is safe to merge.', 'success');
    } else {
      addLog(`🚨 PIPELINE FAILED: ${failureReason}`, 'error');
    }

    // Update active history in state
    const updatedHistory = [...runsHistory, newRunObj];
    setRunsHistory(updatedHistory);
    setActiveRunIndex(updatedHistory.length - 1);
    setCompareRun2Idx(updatedHistory.length - 1);
    setCompareRun1Idx(updatedHistory.length - 2);
    setIsSimulating(false);
  };

  // Trend chart data mapping
  const chartData = runsHistory.map((run) => ({
    name: run.commitId,
    'Hallucination Rate (%)': parseFloat((run.metrics.hallucinationRate * 100).toFixed(1)),
    'Faithfulness (%)': parseFloat((run.metrics.faithfulness * 100).toFixed(1)),
    'Avg Latency (ms)': run.metrics.avgLatency,
    'p95 Latency (ms)': run.metrics.p95Latency,
    'Cost ($)': run.metrics.totalCost * 100 // scaled for visibility
  }));

  const getDeltaString = (metricKey, runIndex, isPercentage = false) => {
    if (runIndex === 0) return { text: 'baseline', type: 'neutral' };
    const current = runsHistory[runIndex].metrics[metricKey];
    const prev = runsHistory[runIndex - 1].metrics[metricKey];
    const diff = current - prev;
    if (diff === 0) return { text: 'no change', type: 'neutral' };

    let sign = diff > 0 ? '+' : '';
    let valStr = isPercentage ? `${sign}${(diff * 100).toFixed(1)}%` : `${sign}${diff.toFixed(1)}`;
    if (metricKey === 'totalCost') valStr = `${sign}$${diff.toFixed(4)}`;

    const lowerIsBetter = ['hallucinationRate', 'avgLatency', 'p95Latency', 'totalCost'].includes(metricKey);
    const improved = lowerIsBetter ? diff < 0 : diff > 0;

    return {
      text: valStr,
      type: improved ? 'success' : 'error'
    };
  };

  // Filter test results
  const filteredTestResults = activeRun.testResults.filter(result => {
    const matchesSearch = result.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          result.question.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || result.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || result.status === statusFilter.toLowerCase();
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="app-viewport">
      {/* 1. FUTURISTIC SIDEBAR */}
      <aside className="app-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">📡</div>
            <div>
              <h1>LLM Eval CI/CD</h1>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', letterSpacing: '0.1em', fontWeight: 'bold' }}>WORKSTATION v1.2</span>
            </div>
          </div>

          <nav className="sidebar-menu">
            <button
              className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <Activity size={18} />
              Metrics Control Room
            </button>
            <button
              className={`menu-item ${activeTab === 'simulator' ? 'active' : ''}`}
              onClick={() => setActiveTab('simulator')}
            >
              <Terminal size={18} />
              CI Run Simulator
            </button>
            <button
              className={`menu-item ${activeTab === 'comparison' ? 'active' : ''}`}
              onClick={() => setActiveTab('comparison')}
            >
              <ArrowRightLeft size={18} />
              Dual-Run Comparator
            </button>
            <button
              className={`menu-item ${activeTab === 'dataset' ? 'active' : ''}`}
              onClick={() => setActiveTab('dataset')}
            >
              <Database size={18} />
              Golden Dataset
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">
              <User size={18} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Anshi Tyagi</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <GitBranch size={10} /> master
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN COCKPIT PANEL */}
      <main className="main-content">
        <header className="content-header">
          <div className="page-title">
            <h2>
              {activeTab === 'dashboard' && 'Metrics Control Room'}
              {activeTab === 'simulator' && 'Automated CI Test Simulator'}
              {activeTab === 'comparison' && 'Dual Run Regression Comparator'}
              {activeTab === 'dataset' && 'Golden Evaluation Test Dataset'}
            </h2>
            <p>
              {activeTab === 'dashboard' && 'Continuous automated LLM verification scoring and regression monitoring.'}
              {activeTab === 'simulator' && 'Modify prompt parameters, chunk configurations, and trigger test merges.'}
              {activeTab === 'comparison' && 'Select two commits to audit regression patterns side-by-side.'}
              {activeTab === 'dataset' && 'Static baseline test collection containing 100+ standard evaluation assets.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className={`status-badge-premium ${activeRun.passed ? 'passed' : 'failed'}`}>
              {activeRun.passed ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {activeRun.passed ? 'Safe to Merge' : 'Merge Blocked'}
            </div>
          </div>
        </header>

        {/* Dynamic Commit Info Ribbon */}
        <div className="commit-ribbon">
          <div className="commit-desc">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--accent-cyan)' }}>
                commit {activeRun.commitId}
              </span>
              <h4>{activeRun.message}</h4>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.4rem' }}>
              Model: <strong style={{ color: '#FFF' }}>{activeRun.model}</strong> • Author: {activeRun.author} • Run: {formatDate(activeRun.timestamp)}
            </p>
          </div>

          {runsHistory.length > 1 && (
            <select
              className="form-select"
              style={{ background: 'rgba(0,0,0,0.5)', borderColor: 'var(--border-color)', borderRadius: '6px' }}
              value={activeRunIndex}
              onChange={(e) => setActiveRunIndex(parseInt(e.target.value))}
            >
              {runsHistory.map((run, index) => (
                <option key={run.commitId} value={index}>
                  [{run.commitId}] {run.message.substring(0, 30)}...
                </option>
              ))}
            </select>
          )}
        </div>

        {/* TAB CONTENTS */}

        {/* Tab 1: Dashboard */}
        {activeTab === 'dashboard' && (
          <>
            {/* KPI Cards with Premium Radial Gauges */}
            <div className="dashboard-grid">
              {/* Hallucination */}
              <div className="glass-panel kpi-card-premium">
                <div className="kpi-details">
                  <span className="kpi-label">Hallucinations (SLA &lt; 5%)</span>
                  <div className="kpi-val" style={{ color: activeRun.metrics.hallucinationRate > 0.05 ? 'var(--color-error)' : 'var(--color-success)' }}>
                    {(activeRun.metrics.hallucinationRate * 100).toFixed(1)}%
                  </div>
                  {(() => {
                    const delta = getDeltaString('hallucinationRate', activeRunIndex, true);
                    return (
                      <span className={delta.type === 'success' ? 'change-up' : delta.type === 'error' ? 'change-down' : 'change-neutral'} style={{ fontSize: '0.7rem', fontWeight: 500 }}>
                        {delta.text} vs prev
                      </span>
                    );
                  })()}
                </div>
                <RadialGauge
                  value={activeRun.metrics.hallucinationRate * 100}
                  max={20}
                  color={activeRun.metrics.hallucinationRate > 0.05 ? 'error' : 'success'}
                  label={`${(activeRun.metrics.hallucinationRate * 100).toFixed(0)}%`}
                />
              </div>

              {/* Faithfulness */}
              <div className="glass-panel kpi-card-premium">
                <div className="kpi-details">
                  <span className="kpi-label">Faithfulness (SLA &gt; 90%)</span>
                  <div className="kpi-val" style={{ color: activeRun.metrics.faithfulness < 0.90 ? 'var(--color-error)' : 'var(--color-success)' }}>
                    {(activeRun.metrics.faithfulness * 100).toFixed(1)}%
                  </div>
                  {(() => {
                    const delta = getDeltaString('faithfulness', activeRunIndex, true);
                    return (
                      <span className={delta.type === 'success' ? 'change-up' : delta.type === 'error' ? 'change-down' : 'change-neutral'} style={{ fontSize: '0.7rem', fontWeight: 500 }}>
                        {delta.text} vs prev
                      </span>
                    );
                  })()}
                </div>
                <RadialGauge
                  value={activeRun.metrics.faithfulness * 100}
                  max={100}
                  color={activeRun.metrics.faithfulness < 0.90 ? 'error' : 'success'}
                />
              </div>

              {/* Latency */}
              <div className="glass-panel kpi-card-premium">
                <div className="kpi-details">
                  <span className="kpi-label">p95 Latency (SLA &lt; 2s)</span>
                  <div className="kpi-val" style={{ color: activeRun.metrics.p95Latency > 2000 ? 'var(--color-error)' : 'var(--color-success)' }}>
                    {(activeRun.metrics.p95Latency / 1000).toFixed(2)}s
                  </div>
                  {(() => {
                    const delta = getDeltaString('p95Latency', activeRunIndex);
                    return (
                      <span className={delta.type === 'success' ? 'change-up' : delta.type === 'error' ? 'change-down' : 'change-neutral'} style={{ fontSize: '0.7rem', fontWeight: 500 }}>
                        {delta.text > 0 ? `+${delta.text}ms` : `${delta.text}ms`} vs prev
                      </span>
                    );
                  })()}
                </div>
                <RadialGauge
                  value={activeRun.metrics.p95Latency}
                  max={3000}
                  color={activeRun.metrics.p95Latency > 2000 ? 'error' : 'cyan'}
                  label={`${(activeRun.metrics.p95Latency / 1000).toFixed(1)}s`}
                />
              </div>

              {/* Cost */}
              <div className="glass-panel kpi-card-premium">
                <div className="kpi-details">
                  <span className="kpi-label">Eval Cost ({activeRun.testResults.length} runs)</span>
                  <div className="kpi-val" style={{ color: 'var(--accent-cyan)' }}>
                    ${activeRun.metrics.totalCost.toFixed(4)}
                  </div>
                  {(() => {
                    const delta = getDeltaString('totalCost', activeRunIndex);
                    return (
                      <span className={delta.type === 'success' ? 'change-up' : delta.type === 'error' ? 'change-down' : 'change-neutral'} style={{ fontSize: '0.7rem', fontWeight: 500 }}>
                        {delta.text} vs prev
                      </span>
                    );
                  })()}
                </div>
                <div style={{ background: 'var(--accent-cyan-bg)', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
                  <DollarSign size={24} />
                </div>
              </div>
            </div>

            {/* SLA Warnings */}
            {!activeRun.passed && (
              <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem', borderLeft: '4px solid var(--color-error)', background: 'rgba(244, 63, 94, 0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-error)' }}>
                  <AlertTriangle size={20} />
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '0.9rem' }}>Quality Pipeline Regression Detected</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                      {activeRun.failureReason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Trends Section */}
            <div className="dashboard-grid">
              <div className="glass-panel span-2" style={{ padding: '1.5rem', height: '350px' }}>
                <h3 className="chart-title">
                  <TrendingUp size={18} style={{ color: 'var(--accent-indigo)' }} />
                  Faithfulness & Hallucination Trend
                </h3>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} />
                    <YAxis stroke="var(--color-text-muted)" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'var(--bg-darker)', borderColor: 'var(--border-color)' }} />
                    <Legend verticalAlign="top" height={36} />
                    <Line type="monotone" dataKey="Faithfulness (%)" stroke="var(--color-success)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Hallucination Rate (%)" stroke="var(--color-error)" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-panel span-2" style={{ padding: '1.5rem', height: '350px' }}>
                <h3 className="chart-title">
                  <TrendingUp size={18} style={{ color: 'var(--accent-cyan)' }} />
                  Latency Response Timeline (ms)
                </h3>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} />
                    <YAxis stroke="var(--color-text-muted)" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'var(--bg-darker)', borderColor: 'var(--border-color)' }} />
                    <Legend verticalAlign="top" height={36} />
                    <Line type="monotone" dataKey="p95 Latency (ms)" stroke="var(--color-warning)" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Avg Latency (ms)" stroke="var(--accent-cyan)" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Test case log with search/filter */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileCode size={18} style={{ color: 'var(--accent-indigo)' }} />
                  Active Run Test Logs ({activeRun.testResults.length} Cases)
                </h3>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {/* Search */}
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search question / ID..."
                      className="form-input"
                      style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.8rem', width: '200px' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Filter Category */}
                  <select
                    className="form-select"
                    style={{ height: '34px', fontSize: '0.8rem', padding: '0 0.5rem' }}
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="All">All Categories</option>
                    <option value="Customer Support">Customer Support</option>
                    <option value="Technical & Coding">Technical &amp; Coding</option>
                    <option value="Financial & Data Extraction">Financial &amp; Extraction</option>
                    <option value="Legal & Document Analysis">Legal &amp; Compliance</option>
                  </select>

                  {/* Filter Status */}
                  <select
                    className="form-select"
                    style={{ height: '34px', fontSize: '0.8rem', padding: '0 0.5rem' }}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="All">All Status</option>
                    <option value="Passed">Passed</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>
              </div>

              <div className="dataset-table-container">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Category</th>
                      <th>Question Preview</th>
                      <th>Status</th>
                      <th>Latency</th>
                      <th>Faithfulness</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTestResults.slice(0, 10).map((result) => (
                      <tr key={result.id} onClick={() => inspectTestCase(result)}>
                        <td style={{ fontWeight: 700, color: 'var(--accent-indigo)' }}>{result.id}</td>
                        <td style={{ fontSize: '0.8rem', fontWeight: 500 }}>{result.category}</td>
                        <td title={result.question} style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {result.question}
                        </td>
                        <td>
                          <span className={`status-badge-premium ${result.status === 'passed' ? 'passed' : 'failed'}`} style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem' }}>
                            {result.status === 'passed' ? 'Passed' : 'Failed'}
                          </span>
                        </td>
                        <td>{result.latency}ms</td>
                        <td>{(result.faithfulness * 100).toFixed(0)}%</td>
                        <td>
                          <button className="menu-item" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Eye size={12} /> Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTestResults.length > 10 && (
                  <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Showing first 10 of {filteredTestResults.length} filtered rows.
                  </div>
                )}
                {filteredTestResults.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
                    No results match your search parameters.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tab 2: Simulator */}
        {activeTab === 'simulator' && (
          <div className="simulator-layout">
            <div className="glass-panel config-panel">
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
                      Get a free key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>Google AI Studio</a>. Stored purely locally.
                    </span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">System Evaluation Prompt Template</label>
                  <textarea
                    className="form-textarea"
                    style={{ minHeight: '100px' }}
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

                <div className="range-inputs">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Evaluation Subset (Test count)</label>
                    <select className="form-select" value={evalSubset} onChange={(e) => setEvalSubset(parseInt(e.target.value))}>
                      <option value="5">5 Cases (Fast API Check)</option>
                      <option value="10">10 Cases (Recommended for API)</option>
                      <option value="25">25 Cases</option>
                      <option value="50">50 Cases</option>
                      <option value="100">All 100 Cases (Full Audit)</option>
                    </select>
                  </div>
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
                  onClick={runSimulator}
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

            {/* Console Output */}
            <div className="terminal-window-premium">
              <div className="terminal-header">
                <div className="console-dots">
                  <span className="console-dot red"></span>
                  <span className="console-dot yellow"></span>
                  <span className="console-dot green"></span>
                </div>
                <span className="console-title">eval-ci-pipeline-runner.sh</span>
                <Terminal size={14} style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <div className="terminal-content">
                {consoleLogs.length === 0 && (
                  <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '7rem' }}>
                    <Terminal size={48} style={{ opacity: 0.15, marginBottom: '1rem', color: 'var(--accent-indigo)' }} />
                    <p style={{ fontWeight: 600 }}>Console Idle</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Configure prompt parameters on the left and run a simulation.</p>
                  </div>
                )}
                {consoleLogs.map((log, idx) => (
                  <div key={idx} className={`console-line ${log.type}`} style={{ fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--color-text-muted)', marginRight: '0.5rem' }}>[{log.time}]</span>
                    {log.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Comparison */}
        {activeTab === 'comparison' && (
          <div>
            <div className="glass-panel compare-selector" style={{ padding: '1rem 1.5rem', marginBottom: '2rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Audit Baseline</span>
              <select
                className="form-select"
                value={compareRun1Idx}
                onChange={(e) => setCompareRun1Idx(parseInt(e.target.value))}
              >
                {runsHistory.map((run, index) => (
                  <option key={run.commitId} value={index}>
                    [{run.commitId}] {run.message.substring(0, 35)}... ({run.model})
                  </option>
                ))}
              </select>
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>VS TARGET</span>
              <select
                className="form-select"
                value={compareRun2Idx}
                onChange={(e) => setCompareRun2Idx(parseInt(e.target.value))}
              >
                {runsHistory.map((run, index) => (
                  <option key={run.commitId} value={index}>
                    [{run.commitId}] {run.message.substring(0, 35)}... ({run.model})
                  </option>
                ))}
              </select>
            </div>

            <div className="comparison-layout">
              {/* Run A */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 className="compare-card-title">
                  <span>Commit {runsHistory[compareRun1Idx].commitId}</span>
                  <span className={`status-badge-premium ${runsHistory[compareRun1Idx].passed ? 'passed' : 'failed'}`} style={{ fontSize: '0.65rem' }}>
                    {runsHistory[compareRun1Idx].passed ? 'Passed' : 'Failed'}
                  </span>
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                  "{runsHistory[compareRun1Idx].message}"
                </p>
                
                <div className="compare-details-grid">
                  <div className="compare-stat">
                    <span className="compare-stat-label">Model Engine</span>
                    <div className="compare-stat-value">{runsHistory[compareRun1Idx].model}</div>
                  </div>
                  <div className="compare-stat">
                    <span className="compare-stat-label">Hallucinations</span>
                    <div className="compare-stat-value" style={{ color: runsHistory[compareRun1Idx].metrics.hallucinationRate > 0.05 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {(runsHistory[compareRun1Idx].metrics.hallucinationRate * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="compare-stat">
                    <span className="compare-stat-label">Faithfulness</span>
                    <div className="compare-stat-value" style={{ color: runsHistory[compareRun1Idx].metrics.faithfulness < 0.9 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {(runsHistory[compareRun1Idx].metrics.faithfulness * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="compare-stat">
                    <span className="compare-stat-label">p95 Response Latency</span>
                    <div className="compare-stat-value" style={{ color: runsHistory[compareRun1Idx].metrics.p95Latency > 2000 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {runsHistory[compareRun1Idx].metrics.p95Latency}ms
                    </div>
                  </div>
                  <div className="compare-stat" style={{ gridColumn: 'span 2' }}>
                    <span className="compare-stat-label">RAG Config Parameters</span>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--color-text-secondary)' }}>
                      Chunk Size: <strong>{runsHistory[compareRun1Idx].ragConfig.chunkSize}</strong> • Top-K: <strong>{runsHistory[compareRun1Idx].ragConfig.topK}</strong>
                    </div>
                  </div>
                  <div className="compare-stat" style={{ gridColumn: 'span 2' }}>
                    <span className="compare-stat-label">System Prompt Template</span>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginTop: '0.5rem', background: '#05070C', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', color: 'var(--color-text-secondary)' }}>
                      {runsHistory[compareRun1Idx].promptTemplate}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Run B */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 className="compare-card-title">
                  <span>Commit {runsHistory[compareRun2Idx].commitId}</span>
                  <span className={`status-badge-premium ${runsHistory[compareRun2Idx].passed ? 'passed' : 'failed'}`} style={{ fontSize: '0.65rem' }}>
                    {runsHistory[compareRun2Idx].passed ? 'Passed' : 'Failed'}
                  </span>
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                  "{runsHistory[compareRun2Idx].message}"
                </p>

                <div className="compare-details-grid">
                  <div className="compare-stat">
                    <span className="compare-stat-label">Model Engine</span>
                    <div className="compare-stat-value">{runsHistory[compareRun2Idx].model}</div>
                  </div>
                  <div className="compare-stat">
                    <span className="compare-stat-label">Hallucinations</span>
                    <div className="compare-stat-value" style={{ color: runsHistory[compareRun2Idx].metrics.hallucinationRate > 0.05 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {(runsHistory[compareRun2Idx].metrics.hallucinationRate * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="compare-stat">
                    <span className="compare-stat-label">Faithfulness</span>
                    <div className="compare-stat-value" style={{ color: runsHistory[compareRun2Idx].metrics.faithfulness < 0.9 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {(runsHistory[compareRun2Idx].metrics.faithfulness * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="compare-stat">
                    <span className="compare-stat-label">p95 Response Latency</span>
                    <div className="compare-stat-value" style={{ color: runsHistory[compareRun2Idx].metrics.p95Latency > 2000 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {runsHistory[compareRun2Idx].metrics.p95Latency}ms
                    </div>
                  </div>
                  <div className="compare-stat" style={{ gridColumn: 'span 2' }}>
                    <span className="compare-stat-label">RAG Config Parameters</span>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--color-text-secondary)' }}>
                      Chunk Size: <strong>{runsHistory[compareRun2Idx].ragConfig.chunkSize}</strong> • Top-K: <strong>{runsHistory[compareRun2Idx].ragConfig.topK}</strong>
                    </div>
                  </div>
                  <div className="compare-stat" style={{ gridColumn: 'span 2' }}>
                    <span className="compare-stat-label">System Prompt Template</span>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginTop: '0.5rem', background: '#05070C', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', color: 'var(--color-text-secondary)' }}>
                      {runsHistory[compareRun2Idx].promptTemplate}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Dataset */}
        {activeTab === 'dataset' && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3>Golden Evaluation Benchmark Set</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                  A static collection of 100+ standard question-answer-context benchmark nodes.
                </p>
              </div>
              <span className="status-badge-premium passed" style={{ padding: '0.35rem 0.75rem' }}>
                Total Benchmark Nodes: {goldenDataset.length}
              </span>
            </div>

            <div className="dataset-table-container">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>ID</th>
                    <th style={{ width: '150px' }}>Category</th>
                    <th style={{ width: '250px' }}>Question</th>
                    <th style={{ width: '350px' }}>Expected Output (Ground Truth)</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {goldenDataset.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700, color: 'var(--accent-indigo)' }}>{item.id}</td>
                      <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.category}</td>
                      <td title={item.question} style={{ whiteSpace: 'normal', maxWidth: '220px' }}>{item.question}</td>
                      <td title={item.expected_answer} style={{ whiteSpace: 'normal', maxWidth: '320px', color: 'var(--color-text-secondary)' }}>
                        {item.expected_answer}
                      </td>
                      <td>
                        {item.tags.map((tag) => (
                          <span key={tag} className="tag-pill">
                            {tag}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 3. INTERACTIVE SLIDE-OUT DRAWER */}
      <div className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`} onClick={closeDrawer} />
      <div className={`drawer-container ${isDrawerOpen ? 'open' : ''}`}>
        {selectedTestCase && (
          <>
            <div className="drawer-header">
              <div>
                <h3 style={{ color: 'var(--accent-indigo)' }}>Test Node {selectedTestCase.id}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{selectedTestCase.category}</span>
              </div>
              <button className="drawer-close" onClick={closeDrawer}>✕</button>
            </div>

            <div className="drawer-body">
              <div>
                <h5 className="drawer-section-label">Evaluation Status</h5>
                <span className={`status-badge-premium ${selectedTestCase.status === 'passed' ? 'passed' : 'failed'}`}>
                  {selectedTestCase.status === 'passed' ? 'Passed Quality Gate' : 'Failed Quality Gate'}
                </span>
              </div>

              <div>
                <h5 className="drawer-section-label">Benchmarked Metrics</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="compare-stat">
                    <span className="compare-stat-label">Latency</span>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>{selectedTestCase.latency}ms</div>
                  </div>
                  <div className="compare-stat">
                    <span className="compare-stat-label">Cost</span>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>${selectedTestCase.cost.toFixed(5)}</div>
                  </div>
                  <div className="compare-stat">
                    <span className="compare-stat-label">Faithfulness</span>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: selectedTestCase.faithfulness < 0.9 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {(selectedTestCase.faithfulness * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="compare-stat">
                    <span className="compare-stat-label">Hallucinated Claims</span>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: selectedTestCase.isHallucinating ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {selectedTestCase.isHallucinating ? '⚠️ Yes' : 'None'}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h5 className="drawer-section-label">User Query Question</h5>
                <div className="drawer-content-box">
                  {selectedTestCase.question}
                </div>
              </div>

              <div>
                <h5 className="drawer-section-label">Reference RAG Context</h5>
                <div className="drawer-content-box" style={{ background: '#050811', borderColor: 'rgba(255,255,255,0.03)', fontSize: '0.75rem', maxHeight: '150px', overflowY: 'auto' }}>
                  {
                    goldenDataset.find(x => x.id === selectedTestCase.id)?.reference_context || 
                    'No reference context recorded.'
                  }
                </div>
              </div>

              <div>
                <h5 className="drawer-section-label">Generated Model Answer Output</h5>
                <div className="drawer-content-box" style={{ borderLeft: `3px solid ${selectedTestCase.isHallucinating ? 'var(--color-error)' : 'var(--color-success)'}` }}>
                  {selectedTestCase.modelOutput}
                </div>
              </div>

              <div>
                <h5 className="drawer-section-label">Expected Answer (Ground Truth)</h5>
                <div className="drawer-content-box" style={{ background: 'rgba(16, 185, 129, 0.03)', borderColor: 'rgba(16, 185, 129, 0.1)' }}>
                  {
                    goldenDataset.find(x => x.id === selectedTestCase.id)?.expected_answer || 
                    'No expected answer recorded.'
                  }
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
