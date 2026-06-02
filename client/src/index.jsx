import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.jsx';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
    sendDefaultPii: false,
    // Strip auth headers from breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        if (breadcrumb.data?.headers) {
          delete breadcrumb.data.headers.Authorization;
          delete breadcrumb.data.headers.Cookie;
        }
      }
      return breadcrumb;
    }
  });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed; app continues without offline support.
    });
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
