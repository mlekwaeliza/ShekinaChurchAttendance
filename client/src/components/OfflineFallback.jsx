import React from 'react';
import { WifiOff, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const OfflineFallback = () => {
  const navigate = useNavigate();
  const [retrying, setRetrying] = React.useState(false);

  const handleRetry = () => {
    setRetrying(true);
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-system-grouped-background p-4">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-system-fill">
          <WifiOff className="h-8 w-8 text-secondary-label" />
        </div>

        <h1 className="mb-2 text-title-1 font-semibold text-label">You're Offline</h1>
        <p className="mb-6 text-subheadline leading-relaxed text-secondary-label">
          It looks like you've lost your internet connection. Some features may not be available
          until you're back online.
        </p>

        <div className="mb-6 rounded-xl bg-system-blue/[0.08] p-4 text-left dark:bg-system-blue/[0.12]">
          <h3 className="mb-1 text-footnote font-semibold text-blue-700 dark:text-system-blue">
            What you can do offline:
          </h3>
          <ul className="space-y-1 text-footnote text-blue-700/90 dark:text-system-blue/90">
            <li>View previously loaded attendance data</li>
            <li>Mark attendance (will sync when online)</li>
            <li>View your submission history</li>
          </ul>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin-slow' : ''}`} />
            {retrying ? 'Retrying...' : 'Try Again'}
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineFallback;
