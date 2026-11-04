import React from 'react';
import { RefreshCw, X } from 'lucide-react';

const PWAUpdatePrompt = ({ onRefresh, onDismiss }) => {
  return (
    <div className="fixed top-4 left-4 right-4 z-50 animate-slide-down sm:left-auto sm:top-6 sm:right-6">
      <div className="card relative max-w-sm border border-system-orange/30 p-4 shadow-elevated dark:border-system-orange/40">
        <button
          onClick={onDismiss}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-secondary-label transition-colors hover:bg-system-fill hover:text-label"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-system-orange/15">
            <RefreshCw className="h-[18px] w-[18px] animate-spin-slow text-amber-700 dark:text-system-orange" />
          </div>

          <div className="flex-1 pr-4">
            <p className="text-footnote font-semibold text-label">Update Available</p>
            <p className="mt-0.5 text-caption-1 leading-relaxed text-secondary-label">
              A new version is ready. Refresh to get the latest features.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button onClick={onRefresh} className="btn-sm btn-primary flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <button onClick={onDismiss} className="btn-sm btn-ghost">
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
