import React from 'react';
import { RefreshCw, X } from 'lucide-react';

const PWAUpdatePrompt = ({ onRefresh, onDismiss }) => {
  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:top-6 sm:right-6 z-50 animate-slide-down">
      <div className="card p-4 shadow-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 max-w-sm">
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
            <RefreshCw className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-spin-slow" />
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Update Available</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              A new version is ready. Refresh to get the latest features.
            </p>

            <div className="flex gap-2 mt-3">
              <button
                onClick={onRefresh}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
              <button
                onClick={onDismiss}
                className="text-xs px-3 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAUpdatePrompt;
