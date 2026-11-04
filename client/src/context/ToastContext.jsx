import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

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
  const endTimeRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    endTimeRef.current.delete(id);
  }, []);

  const pause = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (!timer) return;
    clearTimeout(timer);
    timersRef.current.delete(id);
    const end = endTimeRef.current.get(id);
    // Store the remaining time (ms) so the timer can be re-armed on resume.
    endTimeRef.current.set(id, (end ?? Date.now()) - Date.now());
  }, []);

  const resume = useCallback(
    (id) => {
      const remaining = endTimeRef.current.get(id);
      if (remaining == null || remaining <= 0) {
        endTimeRef.current.delete(id);
        return;
      }
      endTimeRef.current.delete(id);
      const timer = setTimeout(() => dismiss(id), remaining);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  const showToast = useCallback(
    (opts, legacyType) => {
      const normalized =
        typeof opts === 'string' ? { message: opts, type: legacyType || 'info' } : opts || {};
      const id = nextId();
      const toast = {
        id,
        type: normalized.type || 'info',
        title: normalized.title || '',
        message: normalized.message || '',
        duration: normalized.duration ?? 5000,
        action: normalized.action || null,
        createdAt: Date.now()
      };
      setToasts((current) => {
        const next = [...current, toast];
        // Cap visible toasts
        if (next.length > maxToasts) {
          const dropped = next.slice(0, next.length - maxToasts);
          for (const d of dropped) {
            const t = timersRef.current.get(d.id);
            if (t) {
              clearTimeout(t);
              timersRef.current.delete(d.id);
            }
          }
          return next.slice(-maxToasts);
        }
        return next;
      });
      if (toast.duration > 0) {
        const timer = setTimeout(() => dismiss(id), toast.duration);
        timersRef.current.set(id, timer);
        endTimeRef.current.set(id, Date.now() + toast.duration);
      }
      return id;
    },
    [dismiss, maxToasts]
  );

  // Clear all timers on unmount to prevent leaks
  useEffect(() => {
    const timers = timersRef.current;
    const endTimes = endTimeRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      endTimes.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ showToast, dismiss, pause, resume, toasts }),
    [showToast, dismiss, pause, resume, toasts]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} onPause={pause} onResume={resume} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function ToastViewport({ toasts, onDismiss, onPause, onResume }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[10000] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end"
    >
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          toast={t}
          onDismiss={onDismiss}
          onPause={onPause}
          onResume={onResume}
        />
      ))}
    </div>
  );
}

const STYLES = {
  base: 'pointer-events-auto w-full max-w-sm rounded-xl border shadow-card backdrop-blur-xl bg-white/95 border-black/[0.08] dark:bg-[#1c1c1e]/95 dark:border-white/[0.1]'
};

const ACCENTS = {
  info: 'bg-system-blue',
  success: 'bg-system-green',
  warning: 'bg-system-orange',
  error: 'bg-system-red'
};

function ToastCard({ toast, onDismiss, onPause, onResume }) {
  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => onPause(toast.id)}
      onMouseLeave={() => onResume(toast.id)}
      className={`${STYLES.base} transition-all animate-fade-in`}
    >
      <div className="flex items-start gap-3 p-3.5">
        <span
          aria-hidden="true"
          className={`mt-0.5 h-5 w-1 shrink-0 rounded-full ${ACCENTS[toast.type] || ACCENTS.info}`}
        />
        <div className="min-w-0 flex-1">
          {toast.title && (
            <div className="text-footnote font-semibold text-label">{toast.title}</div>
          )}
          {toast.message && (
            <div className="mt-0.5 text-footnote text-secondary-label">{toast.message}</div>
          )}
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action.onClick?.();
                onDismiss(toast.id);
              }}
              className="mt-2 text-footnote font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="flex-shrink-0 rounded-md p-1 text-secondary-label transition-colors hover:bg-system-fill hover:text-label"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M2 2l8 8M10 2l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
