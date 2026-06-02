'use strict';

// Lightweight in-process pub/sub used by the SSE endpoint to push
// real-time events to connected clients (notifications, submission
// updates, follow-up changes, etc.). Survives only for the lifetime
// of the Node process — sufficient for a single-instance deployment
// like Render's `numInstances: 1` setting in render.yaml.
//
// For multi-instance deployments, swap the in-memory `subscribers`
// Map for a Postgres LISTEN/NOTIFY bridge (see TODOs).

const subscribers = new Map(); // userId -> Set<{ res, ping, lastEventId }>
let nextId = 1;

function publish(userId, eventType, data) {
  const subs = subscribers.get(Number(userId));
  if (!subs || subs.size === 0) return 0;
  const payload = {
    id: String(nextId++),
    type: eventType,
    data,
    ts: Date.now()
  };
  const serialized = `id: ${payload.id}\nevent: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  let delivered = 0;
  for (const sub of subs) {
    try {
      sub.res.write(serialized);
      sub.lastEventId = payload.id;
      delivered += 1;
    } catch (err) {
      // The connection is dead; clean it up.
      subs.delete(sub);
      clearInterval(sub.ping);
    }
  }
  if (subs.size === 0) subscribers.delete(Number(userId));
  return delivered;
}

// Broadcast to every connected subscriber (used for system-wide
// events like backup completion).
function broadcast(eventType, data) {
  const payload = {
    id: String(nextId++),
    type: eventType,
    data,
    ts: Date.now()
  };
  const serialized = `id: ${payload.id}\nevent: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  let delivered = 0;
  for (const [userId, subs] of subscribers) {
    for (const sub of subs) {
      try {
        sub.res.write(serialized);
        sub.lastEventId = payload.id;
        delivered += 1;
      } catch (err) {
        subs.delete(sub);
        clearInterval(sub.ping);
      }
    }
    if (subs.size === 0) subscribers.delete(userId);
  }
  return delivered;
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
  return { users: subscribers.size, connections };
}

module.exports = { publish, broadcast, subscribe, stats };
