'use strict';

// Bounded-concurrency semaphore for PostgreSQL queries.
//
// Replaces the fully-serial promise chain in postgresRuntime.js, where every
// query waited for the previous one — capping dashboard latency at
// N * slowest-query. A semaphore with a small limit lets independent queries
// run in parallel against the pg Pool (each gets its own connection) while
// still bounding connection pressure.
//
// Transactions never go through the gate: they check out a dedicated client
// from the pool (see postgresRuntime.withTransaction), so no exclusive mode is
// needed — nothing else can touch a transaction's connection.

function createQueryGate(limit) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('queryGate limit must be a positive integer');
  }

  let active = 0;
  const waiters = [];

  function pump() {
    while (active < limit && waiters.length > 0) {
      active += 1;
      waiters.shift()();
    }
  }

  function acquire() {
    return new Promise((resolve) => {
      waiters.push(resolve);
      pump();
    });
  }

  function release() {
    active = Math.max(0, active - 1);
    pump();
  }

  async function run(fn) {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  return {
    acquire,
    release,
    run,
    get active() {
      return active;
    },
    get waiting() {
      return waiters.length;
    }
  };
}

module.exports = { createQueryGate };
