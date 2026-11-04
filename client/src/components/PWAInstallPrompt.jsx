import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
      setIsInstalled(true);
    } else {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
    setTimeout(() => localStorage.removeItem('pwa-install-dismissed'), 7 * 24 * 60 * 60 * 1000);
  };

  if (isInstalled || !showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up sm:bottom-6 sm:left-auto sm:right-6">
      <div className="card relative max-w-sm p-4 shadow-elevated">
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-secondary-label transition-colors hover:bg-system-fill hover:text-label"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-500/[0.12]">
            <Smartphone className="h-[18px] w-[18px] text-primary-700 dark:text-primary-300" />
          </div>

          <div className="flex-1 pr-4">
            <p className="text-footnote font-semibold text-label">Install App</p>
            <p className="mt-0.5 text-caption-1 leading-relaxed text-secondary-label">
              Add Church Attendance to your home screen for quick access and offline support.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleInstall}
                className="btn-sm btn-primary flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Install
              </button>
              <button onClick={handleDismiss} className="btn-sm btn-ghost">
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
