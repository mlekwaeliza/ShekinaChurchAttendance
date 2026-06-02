import { useEffect, useRef, useState, useCallback } from 'react';

// useEventStream
// ---------------------------------------------------------------------------
// Connects to a Server-Sent Events endpoint and dispatches incoming
// `event: <name>` payloads to the provided handler.
//
//   const status = useEventStream('/api/events', {
//     notification: (data) => { /* ... */ },
//     'attendance-submitted': (data) => { /* ... */ }
//   });
//
// Features:
//   - Automatic reconnect with exponential backoff (cap 30s).
//   - Pauses when the tab is hidden to avoid wasting battery/CPU.
//   - `status` is one of 'connecting' | 'open' | 'reconnecting' | 'closed'.
//   - Cookies are sent (withCredentials: true) so the session works.
//   - Last-Event-ID is forwarded so the server can resume (Phase 6 TODO).
export default function useEventStream(url, handlers = {}) {
  const [status, setStatus] = useState('connecting');
  const esRef = useRef(null);
  const handlersRef = useRef(handlers);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const lastEventIdRef = useRef(null);
  const closedByUserRef = useRef(false);

  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (closedByUserRef.current) return;
    if (esRef.current) {
      try { esRef.current.close(); } catch (_) { /* noop */ }
    }
    setStatus('connecting');
    let es;
    try {
      es = new EventSource(url, { withCredentials: true });
    } catch (err) {
      // EventSource constructor is synchronous and very rarely throws
      // (e.g. invalid URL). Fall back to a reconnecting state.
      setStatus('reconnecting');
      scheduleReconnect();
      return;
    }
    esRef.current = es;

    es.addEventListener('open', () => {
      reconnectAttemptRef.current = 0;
      setStatus('open');
    });

    es.addEventListener('error', () => {
      // The browser will not auto-reconnect on 4xx/5xx; we must.
      try { es.close(); } catch (_) { /* noop */ }
      if (esRef.current === es) esRef.current = null;
      if (closedByUserRef.current) return;
      setStatus('reconnecting');
      scheduleReconnect();
    });

    // Special events
    es.addEventListener('hello', (e) => {
      handlersRef.current.hello?.(safeParse(e.data));
    });

    // Generic dispatch: register one listener for any event name we
    // know about. We could iterate the handlers map and addEventListener
    // for each, but doing it on every event is cheaper and supports
    // dynamic handler sets.
    const dispatch = (e) => {
      if (e.lastEventId) lastEventIdRef.current = e.lastEventId;
      const fn = handlersRef.current[e.type];
      if (fn) {
        try { fn(safeParse(e.data), e); } catch (err) { console.error(`[SSE] handler for ${e.type} threw:`, err); }
      }
    };

    // Register known events by name so handler receives the typed event.
    for (const name of Object.keys(handlersRef.current)) {
      es.addEventListener(name, dispatch);
    }
  }, [url]);

  const scheduleReconnect = useCallback(() => {
    if (closedByUserRef.current) return;
    if (reconnectTimerRef.current) return;
    const attempt = Math.min(reconnectAttemptRef.current++, 6);
    const delay = Math.min(30_000, 500 * 2 ** attempt);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    if (!url) return undefined;
    closedByUserRef.current = false;

    // Respect tab visibility: pause when hidden, resume when visible.
    const onVisibility = () => {
      if (document.hidden) {
        if (esRef.current) {
          try { esRef.current.close(); } catch (_) { /* noop */ }
          esRef.current = null;
        }
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        setStatus('closed');
      } else {
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (!document.hidden) connect();

    return () => {
      closedByUserRef.current = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (esRef.current) {
        try { esRef.current.close(); } catch (_) { /* noop */ }
        esRef.current = null;
      }
      setStatus('closed');
    };
  }, [url, connect]);

  return status;
}

function safeParse(data) {
  if (data == null) return null;
  try { return JSON.parse(data); } catch (_) { return data; }
}
