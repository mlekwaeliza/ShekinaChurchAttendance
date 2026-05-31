const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    });
  });

async function recover() {
  try {
    console.log('🛠️ Starting Credentials Recovery...');

    const newLeaderPass = 'lead123';
    const newAdminPass = 'admin';
    
    const leaderHash = await bcrypt.hash(newLeaderPass, 10);
    const adminHash = await bcrypt.hash(newAdminPass, 10);

    // 1. Reset all leader passwords to lead123
    await run('UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE role = "leader"', [leaderHash]);
    console.log(`✅ Reset all Leader passwords to: ${newLeaderPass} (Length: ${newLeaderPass.length})`);

    // 2. Reset admin password to admin
    await run('UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE username = "admin"', [adminHash]);
    console.log(`✅ Reset Admin password to: ${newAdminPass} (Length: ${newAdminPass.length})`);

    // 3. Specifically verify youth_lead
    await run('UPDATE users SET username = "youth_lead" WHERE username LIKE "youth_lead%"');
    console.log('✅ Cleaned up any potential hidden characters in username "youth_lead"');

    console.log('\n🚀 RECOVERY COMPLETE');
    console.log('Youth Leader Username: youth_lead');
    console.log('Youth Leader Password: lead123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ RECOVERY ERROR:', error);
    process.exit(1);
  }
}

recover();
