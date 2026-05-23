import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Unregister any existing service workers (they interfere with HMR and caching)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
  // Only re-register in production
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('ServiceWorker registered with scope:', registration.scope);
      }).catch((error) => {
        console.log('ServiceWorker registration failed:', error);
      });
    });
  }
}

// Clear all caches to remove stale service worker data
if ('caches' in window) {
  caches.keys().then((names) => {
    names.forEach((name) => caches.delete(name));
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
