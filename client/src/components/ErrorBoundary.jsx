import React from 'react';

// Detects "Failed to fetch dynamically imported module" errors that happen when
// Render (or any CDN) deploys a new build and old hashed chunk URLs are gone.
function isChunkLoadError(error) {
  if (!error) return false;
  const msg = error.message || error.toString();
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    /Loading chunk \d+ failed/.test(msg)
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, reloading: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);

    // Auto-reload once for chunk load errors (stale cache after new deploy)
    if (isChunkLoadError(error)) {
      const alreadyReloaded = sessionStorage.getItem('chunk_reload');
      if (!alreadyReloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        this.setState({ reloading: true });
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.reloading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              New version available — reloading…
            </p>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      const isChunk = isChunkLoadError(this.state.error);
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg dark:shadow-slate-900/50 p-8 max-w-md text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-rose-500 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {isChunk ? 'App updated — please reload' : 'Something went wrong'}
            </h2>
            {!isChunk && this.state.error && (
              <pre className="text-xs text-rose-500 dark:text-rose-400 mb-4 text-left bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg overflow-auto max-h-60 font-mono whitespace-pre-wrap break-all">
                {this.state.error.toString()}
                {this.state.error.stack ? `\n\nStack:\n${this.state.error.stack}` : ''}
              </pre>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {isChunk
                ? 'A new version of the app was deployed. Click below to load the latest version.'
                : 'An unexpected error occurred. Please try refreshing the page.'}
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem('chunk_reload');
                window.location.reload();
              }}
              className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {isChunk ? 'Load Latest Version' : 'Refresh Page'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
