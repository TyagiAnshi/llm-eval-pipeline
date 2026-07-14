import React, { useState } from 'react';
import {
  TrendingUp,
  Activity,
  Play,
  Database,
  ArrowRightLeft,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Sliders
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import Simulator from './components/Simulator';
import Comparator from './components/Comparator';
import Dataset from './components/Dataset';

import { useEvalRuns } from './hooks/useEvalRuns';
import goldenDataset from './data/golden_dataset.json';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const {
    runsHistory,
    activeRunIdx,
    setActiveRunIdx,
    compareRun1Idx,
    setCompareRun1Idx,
    compareRun2Idx,
    setCompareRun2Idx,
    isSimulating,
    simProgress,
    consoleLogs,
    isLoading,
    runEvaluation
  } = useEvalRuns(goldenDataset);

  return (
    <div className="app-viewport">
      {/* Sidebar navigation */}
      <aside className="app-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <Sparkles size={16} style={{ color: '#FFF' }} />
            </div>
            <h1>LLM Eval CI/CD</h1>
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>v1.5 Enterprise</span>

          <nav className="sidebar-menu">
            <button
              className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <TrendingUp size={18} />
              Metrics Control Room
            </button>
            <button
              className={`menu-item ${activeTab === 'simulator' ? 'active' : ''}`}
              onClick={() => setActiveTab('simulator')}
            >
              <Play size={18} />
              CI Run Simulator
            </button>
            <button
              className={`menu-item ${activeTab === 'comparator' ? 'active' : ''}`}
              onClick={() => setActiveTab('comparator')}
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
            <div className="user-avatar">AT</div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Anshi Tyagi</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>Branch: main</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Viewport Content Area */}
      <main className="main-content">
        <header className="content-header">
          <div className="page-title">
            <h2>
              {activeTab === 'dashboard' && 'LLM Eval Cockpit Control Room'}
              {activeTab === 'simulator' && 'Automated CI Test Simulator'}
              {activeTab === 'comparator' && 'Dual-Run Regression Comparator'}
              {activeTab === 'dataset' && 'Golden Benchmark Dataset'}
            </h2>
            <p>
              {activeTab === 'dashboard' && 'Audit active test runs and verify Service Level Agreement quality gates.'}
              {activeTab === 'simulator' && 'Modify prompt templates, RAG parameters, and simulate test merges.'}
              {activeTab === 'comparator' && 'Examine differences in prompt variations and score regressions side-by-side.'}
              {activeTab === 'dataset' && 'View expectations, queries, and grounding context chunks.'}
            </p>
          </div>
        </header>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem', color: 'var(--color-text-secondary)' }}>
            <RefreshCw size={36} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite', color: 'var(--accent-indigo)' }} />
            Loading evaluation history from database...
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                runsHistory={runsHistory}
                activeRunIdx={activeRunIdx}
                setActiveRunIdx={setActiveRunIdx}
                datasetLength={goldenDataset.length}
              />
            )}

            {activeTab === 'simulator' && (
              <Simulator
                runsHistory={runsHistory}
                isSimulating={isSimulating}
                simProgress={simProgress}
                consoleLogs={consoleLogs}
                hasServerKey={hasServerKey}
                runEvaluation={runEvaluation}
              />
            )}

            {activeTab === 'comparator' && (
              <Comparator
                runsHistory={runsHistory}
                compareRun1Idx={compareRun1Idx}
                setCompareRun1Idx={setCompareRun1Idx}
                compareRun2Idx={compareRun2Idx}
                setCompareRun2Idx={setCompareRun2Idx}
              />
            )}

            {activeTab === 'dataset' && (
              <Dataset goldenDataset={goldenDataset} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
