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
        <div className="flex min-h-screen items-center justify-center bg-system-grouped-background">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            <p className="text-footnote font-medium text-secondary-label">
              New version available — reloading…
            </p>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      const isChunk = isChunkLoadError(this.state.error);
      return (
        <div className="flex min-h-screen items-center justify-center bg-system-grouped-background p-4">
          <div className="w-full max-w-md rounded-2xl border border-black/[0.06] bg-secondary-system-grouped-background p-8 text-center shadow-elevated dark:border-white/[0.08]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-system-red/15">
              <svg
                className="h-8 w-8 text-rose-700 dark:text-system-red"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-title-2 font-semibold text-label">
              {isChunk ? 'App updated — please reload' : 'Something went wrong'}
            </h2>
            {!isChunk && this.state.error && (
              <pre className="mb-4 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-system-red/[0.08] p-3 text-left font-mono text-caption-1 text-rose-700 dark:text-system-red">
                {this.state.error.toString()}
                {this.state.error.stack ? `\n\nStack:\n${this.state.error.stack}` : ''}
              </pre>
            )}
            <p className="mb-6 text-subheadline text-secondary-label">
              {isChunk
                ? 'A new version of the app was deployed. Click below to load the latest version.'
                : 'An unexpected error occurred. Please try refreshing the page.'}
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem('chunk_reload');
                window.location.reload();
              }}
              className="btn-primary"
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
