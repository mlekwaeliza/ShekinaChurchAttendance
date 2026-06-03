'use strict';

// Postgres LISTEN/NOTIFY bridge for the in-process realtime bus.
//
// Why: the in-process pub/sub in `realtime/bus.js` only reaches SSE
// subscribers connected to THIS Node process. On Render with
// `numInstances > 1` (see render.yaml) a leader's submission on
// instance A would not reach an admin connected to instance B.
//
// The bridge keeps a long-lived dedicated Postgres client that issues
// `LISTEN shekina_events`. publish() / broadcast() in `bus.js` write a
// NOTIFY when called. Every instance's LISTEN callback then re-fans
// the event out to its LOCAL subscribers.
//
// Loop avoidance: when the bridge callback calls `dispatchFromBridge`,
// it uses `skipBridge: true` so the in-process publish() does NOT
// re-NOTIFY Postgres.

const { Client } = require('pg');

const CHANNEL = 'shekina_events';
let listenClient = null;
let started = false;
let starting = false;
let lastError = null;
let onDispatch = null; // function (target, userId|null, type, data)

async function startBridge() {
  if (started || starting) return;
  starting = true;
  const url = process.env.DATABASE_URL;
  if (!url) {
    starting = false;
    return; // SQLite or no DB — no bridge.
  }
  try {
    listenClient = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false }
    });
    listenClient.on('error', handleClientError);
    listenClient.on('end', handleClientEnd);
    listenClient.on('notification', (msg) => {
      if (msg.channel !== CHANNEL) return;
      let payload;
      try { payload = JSON.parse(msg.payload); } catch (_) { return; }
      if (!payload || typeof payload !== 'object') return;
      if (payload.target === 'user' && payload.userId != null) {
        onDispatch?.('user', payload.userId, payload.type, payload.data);
      } else if (payload.target === 'broadcast') {
        onDispatch?.('broadcast', null, payload.type, payload.data);
      }
    });
    await listenClient.connect();
    await listenClient.query(`LISTEN ${CHANNEL}`);
    started = true;
    starting = false;
    lastError = null;
  } catch (err) {
    lastError = err.message;
    starting = false;
    // Try again in 5s.
    setTimeout(() => { startBridge().catch(() => {}); }, 5000);
  }
}

function handleClientError(err) {
  lastError = err.message;
  started = false;
  // Don't leak the dead client
  try { listenClient?.removeAllListeners(); } catch (_) {}
  listenClient = null;
  setTimeout(() => { startBridge().catch(() => {}); }, 5000);
}

function handleClientEnd() {
  lastError = 'connection ended';
  started = false;
  listenClient = null;
  setTimeout(() => { startBridge().catch(() => {}); }, 5000);
}

async function stopBridge() {
  if (listenClient) {
    try { await listenClient.end(); } catch (_) { /* noop */ }
    listenClient = null;
  }
  started = false;
  starting = false;
}

function notify(userIdOrNull, type, data) {
  if (!started || !listenClient) return false;
  const target = userIdOrNull == null ? 'broadcast' : 'user';
  const payload = JSON.stringify({ target, userId: userIdOrNull, type, data });
  // Fire-and-forget: notify failure must not break the caller.
  listenClient.query(`SELECT pg_notify($1, $2)`, [CHANNEL, payload])
    .catch((err) => { lastError = `notify: ${err.message}`; });
  return true;
}

function setDispatchHandler(fn) {
  onDispatch = typeof fn === 'function' ? fn : null;
}

function status() {
  return {
    started,
    starting,
    hasClient: !!listenClient,
    lastError
  };
}

module.exports = {
  startBridge,
  stopBridge,
  notify,
  setDispatchHandler,
  status,
  CHANNEL
};
