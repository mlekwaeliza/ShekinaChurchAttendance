const BASE = 'http://127.0.0.1:3001';
const { queries } = require('./database');
const bcrypt = require('bcryptjs');

function getCookie(res) {
  const sc = res.headers.get('set-cookie');
  return sc ? sc.split(';')[0] : null;
}
async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const cookie = getCookie(res);
  const data = await res.json().catch(() => ({}));
  console.log(`LOGIN ${username}: status ${res.status}`, data.error || JSON.stringify(data).slice(0,120));
  return cookie;
}
async function call(path, cookie) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
  let body; try { body = await res.json(); } catch (e) { body = await res.text(); }
  const preview = typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 500);
  console.log(`GET ${path}: status ${res.status}`);
  console.log('  ->', preview);
}

(async () => {
  const leader = await queries.getUserByUsername
    ? null
    : null;
  const row = await new Promise((res, rej) => {
    const { get } = require('./database');
    get('SELECT id, username FROM users WHERE role = ? LIMIT 1', ['leader'], (e, r) => e ? rej(e) : res(r));
  });
  if (!row) { console.log('NO LEADER USER FOUND'); return; }
  console.log('Leader user:', row.username, 'id', row.id);
  const hash = bcrypt.hashSync('Test1234!', 10);
  await new Promise((res, rej) => {
    const { run } = require('./database');
    run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.id], (e) => e ? rej(e) : res());
  });
  console.log('Password reset for leader');

  const cookie = await login(row.username, 'Test1234!');
  if (!cookie) { console.log('NO COOKIE'); return; }
  await call('/api/admin/contribution-types', cookie);
  await call('/api/admin/contributions', cookie);
})();
