'use strict';

// In-process pub/sub used by the SSE endpoint to push real-time
// events to connected clients. In single-instance deployments the
// in-process bus alone is sufficient. For multi-instance
// deployments the optional `realtime/bridge.js` (Postgres
// LISTEN/NOTIFY) fan-outs events across processes — see bus.js's
// wiring in `realtime/bus.js`.
//
// Subscriptions are user-keyed. publish() is best-effort: a write
// failure here is logged but never thrown to the caller.

const bridge = require('./bridge');

const subscribers = new Map(); // userId -> Set<{ res, ping, lastEventId }>
let nextId = 1;

function publish(userId, eventType, data, { skipBridge = false } = {}) {
  const subs = subscribers.get(Number(userId));
  if (subs && subs.size > 0) {
    const payload = serialize(eventType, data);
    let delivered = 0;
    for (const sub of subs) {
      try {
        sub.res.write(payload);
        sub.lastEventId = payload.id;
        delivered += 1;
      } catch (err) {
        subs.delete(sub);
        clearInterval(sub.ping);
      }
    }
    if (subs.size === 0) subscribers.delete(Number(userId));
    if (delivered > 0 && !skipBridge) {
      // Cross-instance fan-out. Don't await — this is best-effort.
      bridge.notify(Number(userId), eventType, data);
    }
    return delivered;
  }
  // No local subscribers — still notify so other instances can deliver.
  if (!skipBridge) bridge.notify(Number(userId), eventType, data);
  return 0;
}

function broadcast(eventType, data, { skipBridge = false } = {}) {
  const payload = serialize(eventType, data);
  let delivered = 0;
  for (const [userId, subs] of subscribers) {
    for (const sub of subs) {
      try {
        sub.res.write(payload);
        sub.lastEventId = payload.id;
        delivered += 1;
      } catch (err) {
        subs.delete(sub);
        clearInterval(sub.ping);
      }
    }
    if (subs.size === 0) subscribers.delete(userId);
  }
  if (!skipBridge) bridge.notify(null, eventType, data);
  return delivered;
}

function serialize(eventType, data) {
  return `id: ${nextId++}\nevent: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

function subscribe(userId, res) {
  const id = Number(userId);
  if (!subscribers.has(id)) subscribers.set(id, new Set());
  const sub = { res, ping: null, lastEventId: null };
  subscribers.get(id).add(sub);

  // SSE keepalive every 25s — beats the typical 30s proxy idle timeout.
  sub.ping = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch (_) {
      clearInterval(sub.ping);
      subscribers.get(id)?.delete(sub);
    }
  }, 25_000).unref?.();

  return () => {
    clearInterval(sub.ping);
    subscribers.get(id)?.delete(sub);
    if (subscribers.get(id)?.size === 0) subscribers.delete(id);
  };
}

function stats() {
  let connections = 0;
  for (const subs of subscribers.values()) connections += subs.size;
  return { users: subscribers.size, connections, bridge: bridge.status() };
}

// Wire the bridge's NOTIFY callback to local-only delivery so a
// publish on instance A reaches instance B's subscribers exactly
// once (and never loops back to Postgres).
bridge.setDispatchHandler((target, userId, type, data) => {
  if (target === 'user') publish(userId, type, data, { skipBridge: true });
  else if (target === 'broadcast') broadcast(type, data, { skipBridge: true });
});

module.exports = { publish, broadcast, subscribe, stats, bridge };
