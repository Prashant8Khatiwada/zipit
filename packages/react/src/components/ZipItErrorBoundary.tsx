import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ZipItErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ZipIt] Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-8 border-2 border-dashed border-red-500/50 bg-red-500/5 rounded-2xl text-center">
          <h2 className="text-xl font-bold text-red-400 mb-4">Something went wrong</h2>
          <p className="text-gray-400 mb-6 text-sm">
            {this.state.error?.message || 'An unexpected error occurred in the ZipIt engine.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
