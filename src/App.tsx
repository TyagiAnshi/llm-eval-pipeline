import { lazy, Suspense, useState } from 'react';
import {
  TrendingUp,
  Play,
  Database,
  ArrowRightLeft,
  Sparkles,
  RefreshCw
} from 'lucide-react';

import { useEvalRuns } from './hooks/useEvalRuns.ts';
import goldenDataset from './data/golden_dataset.json';

const Dashboard = lazy(() => import('./components/Dashboard.tsx'));
const Simulator = lazy(() => import('./components/Simulator.tsx'));
const Comparator = lazy(() => import('./components/Comparator.tsx'));
const Dataset = lazy(() => import('./components/Dataset.tsx'));

type ActiveTab = 'dashboard' | 'simulator' | 'comparator' | 'dataset';

function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-state">
      <RefreshCw size={36} className="animate-spin spin-icon" />
      {label}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const {
    runsHistory,
    activeRunIdx,
    compareRun1Idx,
    setCompareRun1Idx,
    compareRun2Idx,
    setCompareRun2Idx,
    isSimulating,
    simProgress,
    consoleLogs,
    isLoading,
    hasServerKey,
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
          <span className="eyebrow-label">v1.5 Enterprise</span>

          <nav className="sidebar-menu" aria-label="Workstation tabs">
            <button
              type="button"
              className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              aria-current={activeTab === 'dashboard' ? 'page' : undefined}
              onClick={() => setActiveTab('dashboard')}
            >
              <TrendingUp size={18} />
              Metrics Control Room
            </button>
            <button
              type="button"
              className={`menu-item ${activeTab === 'simulator' ? 'active' : ''}`}
              aria-current={activeTab === 'simulator' ? 'page' : undefined}
              onClick={() => setActiveTab('simulator')}
            >
              <Play size={18} />
              CI Run Simulator
            </button>
            <button
              type="button"
              className={`menu-item ${activeTab === 'comparator' ? 'active' : ''}`}
              aria-current={activeTab === 'comparator' ? 'page' : undefined}
              onClick={() => setActiveTab('comparator')}
            >
              <ArrowRightLeft size={18} />
              Dual-Run Comparator
            </button>
            <button
              type="button"
              className={`menu-item ${activeTab === 'dataset' ? 'active' : ''}`}
              aria-current={activeTab === 'dataset' ? 'page' : undefined}
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
              <div className="text-sm text-muted">Branch: main</div>
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
          <LoadingState label="Loading evaluation history from database..." />
        ) : (
          <Suspense fallback={<LoadingState label="Loading view..." />}>
            {activeTab === 'dashboard' && (
              <Dashboard
                runsHistory={runsHistory}
                activeRunIdx={activeRunIdx}
              />
            )}

            {activeTab === 'simulator' && (
              <Simulator
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
          </Suspense>
        )}
      </main>
    </div>
  );
}
