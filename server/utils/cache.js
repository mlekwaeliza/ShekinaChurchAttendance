/**
 * Lightweight in-process TTL cache for expensive analytics endpoints.
 *
 * Usage:
 *   const { withCache, invalidate, withTimeout } = require('./cache');
 *   const result = await withCache('key', ttlMs, () => expensiveQuery());
 *   const result = await withTimeout(expensivePromise(), 30000);
 *
 * Keys are invalidated automatically when their TTL expires.
 * Call invalidate(prefix) to eagerly bust keys that match a string prefix.
 */

const store = new Map(); // key -> { value, expiresAt }

/**
 * Return a cached value for `key`, or compute it via `fn()`, cache it, then return it.
 * @param {string} key
 * @param {number} ttlMs  - milliseconds to keep the value
 * @param {() => Promise<any>} fn - async factory
 */
async function withCache(key, ttlMs, fn) {
  const now = Date.now();
  const cached = store.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const value = await fn();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/**
 * Race a promise against a timeout. Rejects with an Error if `ms` elapses
 * before `promise` settles.
 * @param {Promise} promise
 * @param {number} ms
 * @param {string} [errorMessage]
 */
function withTimeout(promise, ms, errorMessage) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage || `Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Remove all entries whose key starts with `prefix`.
 * Pass no argument (or '') to clear everything.
 * @param {string} [prefix]
 */
function invalidate(prefix = '') {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

// Sweep expired entries every 5 minutes to prevent unbounded growth
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}, 5 * 60 * 1000);
sweep.unref?.(); // don't keep the process alive for this alone

module.exports = { withCache, invalidate, withTimeout };
