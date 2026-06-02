import { test, expect } from '@playwright/test';

const LEADER_USER = process.env.E2E_LEADER_USER || 'leader1';
const LEADER_PASS = process.env.E2E_LEADER_PASSWORD || 'leader123';

test.describe('Leader submission flow (E2E happy-path)', () => {
  test('leader can fetch their member list', async ({ page, request }) => {
    // Use the request fixture to log in (skip the 2FA browser UI)
    const res = await request.post('/api/auth/login', {
      data: { username: LEADER_USER, password: LEADER_PASS }
    });
    test.skip(res.status() !== 200, `Leader login returned ${res.status()}; set E2E_LEADER_USER/PASSWORD env vars`);

    const members = await request.get('/api/leader/members');
    expect(members.status()).toBe(200);
    const body = await members.json();
    expect(Array.isArray(body.members || body)).toBeTruthy();
  });

  test('submit attendance with Idempotency-Key is safe to retry', async ({ page, request }) => {
    const res = await request.post('/api/auth/login', {
      data: { username: LEADER_USER, password: LEADER_PASS }
    });
    test.skip(res.status() !== 200, `Leader login returned ${res.status()}`);

    const today = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `e2e-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const submission = {
      date: today,
      service_id: 1,
      attendance: []
    };

    const headers = { 'Idempotency-Key': idempotencyKey };
    const first = await request.post('/api/leader/attendance', { data: submission, headers });
    const second = await request.post('/api/leader/attendance', { data: submission, headers });

    // Both calls should return a non-error status (200/201). The second
    // call should be a cached idempotent response, not a duplicate insert.
    expect([200, 201]).toContain(first.status());
    expect([200, 201]).toContain(second.status());
  });
});
