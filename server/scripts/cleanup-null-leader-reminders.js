// One-off cleanup: mark unsent birthday_greeting / follow_up_reminder
// reminders with a null leader_user_id in the payload as sent. These
// reminders can never be delivered (no target user) and were causing a
// 23502 NOT NULL violation on notifications.user_id every 15 minutes.
//
// Idempotent. Safe to re-run. Cross-driver (PostgreSQL + SQLite).
require('dotenv').config();
const usePostgres = String(process.env.DB_CLIENT || '').toLowerCase() === 'postgres';
const { query, run, close } = require('../db/postgres');
const path = require('path');

const SQLITE_PATH = process.env.SQLITE_PATH || path.resolve(__dirname, '../data/church.db');

async function cleanupPg() {
  const result = await query(
    `SELECT id, type, payload FROM scheduled_reminders
     WHERE sent = 0
       AND type IN ('birthday_greeting', 'follow_up_reminder')
       AND payload IS NOT NULL
       AND payload::text LIKE '%"leader_user_id":null%'`
  );
  let marked = 0;
  for (const row of result.rows) {
    let payload = null;
    try { payload = JSON.parse(row.payload); } catch (_) { /* skip */ }
    if (payload && payload.leader_user_id == null) {
      await run('UPDATE scheduled_reminders SET sent = 1, sent_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id]);
      console.log(`PG: marked reminder ${row.id} (${row.type}, member_id=${payload.member_id}) as sent (null leader_user_id)`);
      marked++;
    }
  }
  return marked;
}

function cleanupSqlite() {
  const sqliteDb = require('better-sqlite3');
  const db = new sqliteDb(SQLITE_PATH);
  try {
    const rows = db.prepare(
      `SELECT id, type, payload FROM scheduled_reminders
       WHERE sent = 0
         AND type IN ('birthday_greeting', 'follow_up_reminder')
         AND payload IS NOT NULL
         AND payload LIKE '%"leader_user_id":null%'`
    ).all();
    const update = db.prepare('UPDATE scheduled_reminders SET sent = 1, sent_at = CURRENT_TIMESTAMP WHERE id = ?');
    let marked = 0;
    for (const row of rows) {
      let payload = null;
      try { payload = JSON.parse(row.payload); } catch (_) { /* skip */ }
      if (payload && payload.leader_user_id == null) {
        update.run(row.id);
        console.log(`SQLite: marked reminder ${row.id} (${row.type}, member_id=${payload.member_id}) as sent (null leader_user_id)`);
        marked++;
      }
    }
    return marked;
  } finally {
    db.close();
  }
}

async function main() {
  const driver = usePostgres ? 'postgres' : 'sqlite';
  console.log(`Driver: ${driver}`);
  const marked = usePostgres ? await cleanupPg() : cleanupSqlite();
  console.log(`Done. Marked ${marked} unsent reminder(s) as sent.`);
}

main()
  .catch((error) => { console.error('Cleanup failed:', error); process.exitCode = 1; })
  .finally(() => { if (usePostgres) close(); });
