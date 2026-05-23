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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="card max-w-md w-full text-center p-8">
        <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
          <WifiOff className="w-8 h-8 text-slate-400" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          You're Offline
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          It looks like you've lost your internet connection. Some features may not be available until you're back online.
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 text-left">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
            What you can do offline:
          </h3>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>View previously loaded attendance data</li>
            <li>Mark attendance (will sync when online)</li>
            <li>View your submission history</li>
          </ul>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin-slow' : ''}`} />
            {retrying ? 'Retrying...' : 'Try Again'}
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-secondary flex items-center gap-2"
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
