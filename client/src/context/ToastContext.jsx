import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Lightweight toast system used by SSE-driven notifications and other
// transient messages. Toasts auto-dismiss after `duration` ms (default
// 5000) but can be hovered to pause and manually dismissed via the X
// button. Maximum 4 toasts visible at once (oldest is dropped).
//
// Usage:
//   const { showToast } = useToast();
//   showToast({ type: 'info', title: 'New notification', message: '...' });

const ToastContext = createContext(null);

let _id = 0;
const nextId = () => ++_id;

export function ToastProvider({ children, maxToasts = 4 }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const pause = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback((opts) => {
    const id = nextId();
    const toast = {
      id,
      type: opts.type || 'info',
      title: opts.title || '',
      message: opts.message || '',
      duration: opts.duration ?? 5000,
      action: opts.action || null,
      createdAt: Date.now()
    };
    setToasts((current) => {
      const next = [...current, toast];
      // Cap visible toasts
      if (next.length > maxToasts) {
        const dropped = next.slice(0, next.length - maxToasts);
        for (const d of dropped) {
          const t = timersRef.current.get(d.id);
          if (t) { clearTimeout(t); timersRef.current.delete(d.id); }
        }
        return next.slice(-maxToasts);
      }
      return next;
    });
    if (toast.duration > 0) {
      const timer = setTimeout(() => dismiss(id), toast.duration);
      timersRef.current.set(id, timer);
    }
    return id;
  }, [dismiss, maxToasts]);

  // Clear all timers on unmount to prevent leaks
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast, dismiss, pause, toasts }), [showToast, dismiss, pause, toasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} onPause={pause} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function ToastViewport({ toasts, onDismiss, onPause }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[10000] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} onPause={onPause} />
      ))}
    </div>
  );
}

const ICONS = {
  info: 'ⓘ',
  success: '✓',
  warning: '!',
  error: '✕'
};

const STYLES = {
  info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  error: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100'
};

function ToastCard({ toast, onDismiss, onPause }) {
  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => onPause(toast.id)}
      className={`pointer-events-auto w-full max-w-sm rounded-lg border shadow-lg backdrop-blur-sm transition-all animate-fade-in ${STYLES[toast.type] || STYLES.info}`}
    >
      <div className="flex items-start gap-3 p-3">
        <div className="flex-shrink-0 text-lg leading-none" aria-hidden="true">{ICONS[toast.type] || ICONS.info}</div>
        <div className="min-w-0 flex-1">
          {toast.title && <div className="text-sm font-semibold">{toast.title}</div>}
          {toast.message && <div className="mt-0.5 text-sm opacity-90">{toast.message}</div>}
          {toast.action && (
            <button
              type="button"
              onClick={() => { toast.action.onClick?.(); onDismiss(toast.id); }}
              className="mt-2 text-sm font-medium underline underline-offset-2 hover:no-underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="flex-shrink-0 rounded p-1 opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
