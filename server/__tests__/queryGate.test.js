const { createQueryGate } = require('../db/queryGate');

describe('createQueryGate', () => {
  test('rejects a non-positive limit', () => {
    expect(() => createQueryGate(0)).toThrow('positive integer');
    expect(() => createQueryGate(2.5)).toThrow('positive integer');
    expect(() => createQueryGate(Number.NaN)).toThrow('positive integer');
  });

  test('runs at most `limit` functions concurrently', async () => {
    const gate = createQueryGate(3);
    let inFlight = 0;
    let maxInFlight = 0;

    await Promise.all(
      Array.from({ length: 12 }, () =>
        gate.run(async () => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise((r) => setTimeout(r, 10));
          inFlight -= 1;
        })
      )
    );

    expect(maxInFlight).toBe(3);
    expect(gate.active).toBe(0);
    expect(gate.waiting).toBe(0);
  });

  test('runs at most `limit` functions concurrently when limit is 1', async () => {
    const gate = createQueryGate(1);
    const order = [];
    let inFlight = 0;
    let maxInFlight = 0;

    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        gate.run(async () => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          order.push(i);
          await new Promise((r) => setTimeout(r, 5));
          inFlight -= 1;
        })
      )
    );

    expect(maxInFlight).toBe(1);
    expect(order).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('preserves FIFO ordering of waiters', async () => {
    const gate = createQueryGate(2);
    const order = [];

    const first = gate.run(async () => {
      order.push('a');
      await new Promise((r) => setTimeout(r, 15));
    });
    const second = gate.run(async () => {
      order.push('b');
      await new Promise((r) => setTimeout(r, 15));
    });
    // These two queue up behind a and b.
    const third = gate.run(async () => {
      order.push('c');
      await new Promise((r) => setTimeout(r, 5));
    });
    const fourth = gate.run(async () => {
      order.push('d');
      await new Promise((r) => setTimeout(r, 5));
    });

    await Promise.all([first, second, third, fourth]);
    // With a limit of 2 and equal delays, c must not overtake b.
    expect(order.indexOf('c')).toBeGreaterThan(order.indexOf('b'));
    expect(order.indexOf('d')).toBeGreaterThan(order.indexOf('b'));
  });

  test('propagates rejected functions and stays usable afterwards', async () => {
    const gate = createQueryGate(2);
    await expect(gate.run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');

    expect(gate.active).toBe(0);
    await expect(gate.run(async () => 'ok')).resolves.toBe('ok');
  });

  test('acquire/release manual control holds the limit', async () => {
    const gate = createQueryGate(1);
    await gate.acquire();
    expect(gate.active).toBe(1);

    const attempted = gate.run(async () => 'ran');
    await new Promise((r) => setTimeout(r, 10));
    expect(gate.waiting).toBe(1);

    gate.release();
    await expect(attempted).resolves.toBe('ran');
    expect(gate.active).toBe(0);
  });
});
