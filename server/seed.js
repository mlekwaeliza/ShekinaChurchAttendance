const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    });
  });

async function seed() {
  try {
    console.log('🌱 Seeding sample data...');

    // Clear existing data (except admin user)
    await run('DELETE FROM attendance');
    await run('DELETE FROM submission_log');
    await run('DELETE FROM notifications');
    await run('DELETE FROM members');
    await run('DELETE FROM leaders');
    await run('DELETE FROM users WHERE role = "leader"');
    await run('DELETE FROM sections');
    console.log('🧹 Cleared existing data');

    // 1. Create sections
    const sections = ['Choir', 'Youth Ministry', 'Adults', "Men's Fellowship", "Women's Ministry"];
    for (const name of sections) {
      await run('INSERT INTO sections (name) VALUES (?)', [name]);
    }
    console.log(`✅ Created ${sections.length} sections`);

    // 2. Create leaders
    const leaderData = [
      { username: 'choir_lead', name: 'Grace Moyo', section: 'Choir', isHead: true, phone: '+263 77 123 4567', email: 'grace@church.org' },
      { username: 'choir_asst', name: 'David Chikwanha', section: 'Choir', isHead: false, phone: '+263 77 234 5678', email: 'david@church.org' },
      { username: 'youth_lead', name: 'Tafadzwa Ncube', section: 'Youth Ministry', isHead: true, phone: '+263 77 345 6789', email: 'tafadzwa@church.org' },
      { username: 'adults_lead', name: 'Rumbidzai Mutasa', section: 'Adults', isHead: true, phone: '+263 77 456 7890', email: 'rumbidzai@church.org' },
      { username: 'adults_asst', name: 'Simba Gumbo', section: 'Adults', isHead: false, phone: '+263 77 567 8901', email: 'simba@church.org' },
      { username: 'men_lead', name: 'Farai Chidziva', section: "Men's Fellowship", isHead: true, phone: '+263 77 678 9012', email: 'farai@church.org' },
      { username: 'women_lead', name: 'Tsitsi Mhlanga', section: "Women's Ministry", isHead: true, phone: '+263 77 789 0123', email: 'tsitsi@church.org' },
    ];

    const leaderMap = {};
    for (const l of leaderData) {
      const hash = await bcrypt.hash('leader123', 10);
      const user = await run('INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)', [l.username, hash, 'leader', l.name]);
      const section = await all('SELECT id FROM sections WHERE name = ?', [l.section]);
      await run('INSERT INTO leaders (user_id, section_id, phone, email, is_head) VALUES (?, ?, ?, ?, ?)', [user.lastID, section[0].id, l.phone, l.email, l.isHead ? 1 : 0]);
      leaderMap[l.name] = { userId: user.lastID, leaderId: await all('SELECT id FROM leaders WHERE user_id = ?', [user.lastID]).then(r => r[0].id) };
    }
    console.log(`✅ Created ${leaderData.length} leaders`);

    // 3. Create members
    const memberNames = {
      'Choir': ['Tendai Moyo', 'Chipo Mupfumi', 'Kudakwashe Banda', 'Nyasha Chikwanha', 'Rudo Mutasa', 'Tatenda Gumbo', 'Farai Chidziva', 'Rumbi Mhlanga', 'Simba Ncube', 'Tariro Chikwanha'],
      'Youth Ministry': ['Blessing Moyo', 'Tafadzwa Chikwanha', 'Kudzi Mutasa', 'Tinashe Gumbo', 'Ropafadzo Chidziva', 'Shamiso Mhlanga', 'Tatenda Ncube', 'Ruvimbo Banda', 'Kuda Mupfumi', 'Tendai Chikwanha'],
      'Adults': ['Munyaradzi Moyo', 'Chiedza Chikwanha', 'Simbarashe Mutasa', 'Nyasha Gumbo', 'Rudo Chidziva', 'Tafadzwa Mhlanga', 'Kudakwashe Ncube', 'Rumbidzai Banda', 'Tariro Mupfumi', 'Farai Chikwanha', 'Tsitsi Moyo', 'Blessing Mutasa'],
      "Men's Fellowship": ['Simba Chidziva', 'Tafadzwa Gumbo', 'Kudakwashe Ncube', 'Tendai Banda', 'Munyaradzi Mhlanga', 'Simbarashe Chikwanha', 'Tinashe Mupfumi', 'Farai Moyo'],
      "Women's Ministry": ['Rumbidzai Chikwanha', 'Chipo Mutasa', 'Nyasha Ncube', 'Rudo Mhlanga', 'Tariro Gumbo', 'Tsitsi Banda', 'Shamiso Chidziva', 'Ropafadzo Mupfumi', 'Chiedza Moyo', 'Ruvimbo Mutasa'],
    };

    const memberMap = {};
    let membershipNum = 1001;
    const genders = ['Male', 'Female'];
    const ageGroups = ['18-25', '26-35', '36-50', '51+'];

    for (const [sectionName, names] of Object.entries(memberNames)) {
      const section = await all('SELECT id FROM sections WHERE name = ?', [sectionName]);
      const sectionLeaders = await all('SELECT id FROM leaders WHERE section_id = ?', [section[0].id]);
      const leaderId = sectionLeaders[0].id;

      for (const name of names) {
        const gender = name.split(' ')[0].length % 2 === 0 ? 'Female' : 'Male';
        const ageGroup = ageGroups[Math.floor(Math.random() * ageGroups.length)];
        const member = await run('INSERT INTO members (membership_id, full_name, section_id, leader_id, gender, age_group) VALUES (?, ?, ?, ?, ?, ?)', [String(membershipNum++), name, section[0].id, leaderId, gender, ageGroup]);
        memberMap[name] = { id: member.lastID, section: sectionName };
      }
    }
    console.log(`✅ Created ${Object.keys(memberMap).length} members`);

    // 4. Create attendance records for the past 12 weeks
    const today = new Date();
    const weeks = [];
    for (let w = 0; w < 12; w++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (w * 7));
      // Use Sunday of each week
      while (d.getDay() !== 0) d.setDate(d.getDate() - 1);
      weeks.push(d.toISOString().split('T')[0]);
    }

    let attendanceCount = 0;
    let logCount = 0;

    for (const date of weeks) {
      for (const [sectionName, names] of Object.entries(memberNames)) {
        const section = await all('SELECT id FROM sections WHERE name = ?', [sectionName]);
        const sectionLeaders = await all('SELECT l.id, l.user_id FROM leaders l WHERE l.section_id = ?', [section[0].id]);
        const headLeader = sectionLeaders.find(l => true) || sectionLeaders[0];

        // Insert submission log
        await run('INSERT OR IGNORE INTO submission_log (leader_id, section_id, date) VALUES (?, ?, ?)', [headLeader.id, section[0].id, date]);
        logCount++;

        // Insert attendance for each member
        for (const name of names) {
          const member = memberMap[name];
          if (!member) continue;

          // 70-95% attendance rate, varying by member
          const seed = name.length + date.length;
          const presentChance = 0.7 + (seed % 25) / 100;
          const status = Math.random() < presentChance ? 'present' : (Math.random() < 0.7 ? 'absent' : 'excused');

          await run('INSERT OR IGNORE INTO attendance (member_id, date, status, submitted_by) VALUES (?, ?, ?, ?)', [member.id, date, status, headLeader.userId]);
          attendanceCount++;
        }
      }
    }
    console.log(`✅ Created ${attendanceCount} attendance records across ${weeks.length} weeks`);
    console.log(`✅ Created ${logCount} submission logs`);

    console.log('\n🎉 Seed complete!');
    console.log('\n📊 Summary:');
    console.log(`   Sections: ${sections.length}`);
    console.log(`   Leaders: ${leaderData.length}`);
    console.log(`   Members: ${Object.keys(memberMap).length}`);
    console.log(`   Attendance records: ${attendanceCount}`);
    console.log(`   Weeks of data: ${weeks.length}`);
    console.log('\n🔑 Leader password: leader123');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
