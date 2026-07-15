import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in workstation UI:", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="glass-panel error-boundary-panel">
          <h2 className="flex-row gap-sm" style={{ justifyContent: 'center', color: 'var(--color-error)' }}>
            <AlertTriangle size={20} />
            Something went wrong
          </h2>
          <p className="text-muted" style={{ marginTop: '0.75rem' }}>
            The dashboard hit an unexpected error and could not continue rendering this view.
            Reloading the page will reset the UI state.
          </p>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
