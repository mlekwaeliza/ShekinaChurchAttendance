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
    console.log('🌱 Seeding robust service-aware data (Clean Slate)...');

    // 1. Drop and Recreate Tables to Ensure Correct Schema
    await run('DROP TABLE IF EXISTS attendance');
    await run('DROP TABLE IF EXISTS submission_log');
    await run('DROP TABLE IF EXISTS outreach_logs');
    await run('DROP TABLE IF EXISTS pastoral_care_queue');
    await run('DROP TABLE IF EXISTS hall_of_fame_adjustments');
    await run('DROP TABLE IF EXISTS members');
    await run('DROP TABLE IF EXISTS leaders');
    await run('DROP TABLE IF EXISTS sections');
    await run('DROP TABLE IF EXISTS service_types');
    await run('DELETE FROM users WHERE role != "admin"');
    console.log('🧹 Cleared existing data');

    await run(`
      CREATE TABLE service_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        default_day TEXT,
        default_time TEXT,
        eligibility_rules TEXT,
        points_config TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE leaders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        section_id INTEGER NOT NULL,
        phone TEXT,
        email TEXT,
        is_head BOOLEAN DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
      )
    `);

    await run(`
      CREATE TABLE outreach_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        leader_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        contact_method TEXT NOT NULL CHECK(contact_method IN ('Call', 'WhatsApp', 'SMS', 'Visit', 'Prayer', 'Counseling', 'Hospital Visit', 'Other', 'sms', 'whatsapp', 'phone', 'email', 'visit', 'other')),
        outcome TEXT,
        service_id INTEGER,
        created_by INTEGER,
        message TEXT,
        week_start DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (service_id) REFERENCES service_types(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await run(`
      CREATE TABLE pastoral_care_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        assigned_by INTEGER NOT NULL,
        assigned_to INTEGER NOT NULL,
        due_date DATE NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled')),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await run(`
      CREATE TABLE hall_of_fame_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        points INTEGER NOT NULL,
        reason TEXT NOT NULL,
        outreach_log_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      )
    `);

    await run(`
      CREATE TABLE members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        membership_id TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        section_id INTEGER NOT NULL,
        leader_id INTEGER NOT NULL,
        phone TEXT,
        email TEXT,
        gender TEXT,
        date_of_birth DATE,
        age_group TEXT,
        show_age_to_leaders INTEGER DEFAULT 0,
        hide_from_birthday_list INTEGER DEFAULT 0,
        opt_out_services TEXT DEFAULT '[]',
        visitor_date DATE,
        status TEXT DEFAULT 'Active',
        flags TEXT DEFAULT '[]',
        last_contacted_at DATETIME,
        last_contacted_by INTEGER,
        prayer_requests TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        hall_of_fame_points INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
        FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE CASCADE,
        FOREIGN KEY (last_contacted_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await run(`
      CREATE TABLE submission_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        leader_id INTEGER NOT NULL,
        section_id INTEGER NOT NULL,
        date DATE NOT NULL,
        service_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(leader_id, date, service_id)
      )
    `);

    await run(`
      CREATE TABLE attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        date DATE NOT NULL,
        status TEXT NOT NULL,
        service_type_id INTEGER,
        submitted_by INTEGER NOT NULL,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(member_id, date, service_type_id)
      )
    `);

    // 2. Create Service Types
    const services = [
      { id: 1, name: 'Main Service', day: 'Sunday', rules: {}, points: { present: 10, excused: 3 } },
      { id: 2, name: 'Leaders Gathering', day: 'Tuesday', rules: { role: 'Leader' }, points: { present: 20, excused: 5 } },
      { id: 3, name: 'Youth Service', day: 'Wednesday', rules: { section: 'Youth Ministry', age_range: [13, 25] }, points: { present: 15, excused: 5 } },
      { id: 4, name: 'Women\'s Service', day: 'Thursday', rules: { gender: 'Female', section: 'Women\'s Ministry' }, points: { present: 15, excused: 5 } },
      { id: 5, name: 'Prayer Service', day: 'Friday', rules: {}, points: { present: 5, excused: 1 } }
    ];

    for (const s of services) {
      await run(
        'INSERT INTO service_types (id, name, default_day, eligibility_rules, points_config) VALUES (?, ?, ?, ?, ?)',
        [s.id, s.name, s.day, JSON.stringify(s.rules), JSON.stringify(s.points)]
      );
    }
    console.log('✅ Created 5 Service Types');

    // 3. Create Sections
    const sections = ['Worship Team', 'Youth Ministry', 'Women\'s Ministry', 'Men\'s Fellowship', 'Hospitality', 'Media & IT'];
    const sectionIds = {};
    for (const name of sections) {
      const res = await run('INSERT INTO sections (name) VALUES (?)', [name]);
      sectionIds[name] = res.lastID;
    }
    console.log(`✅ Created ${sections.length} sections`);

    // 4. Create Leaders
    const leaderPassword = await bcrypt.hash('leader123', 10);
    const leadersToCreate = [
      { username: 'youth_lead', name: 'Tafadzwa Ncube', section: 'Youth Ministry', isHead: 1 },
      { username: 'worship_lead', name: 'Grace Moyo', section: 'Worship Team', isHead: 1 },
      { username: 'women_lead', name: 'Tsitsi Mhlanga', section: 'Women\'s Ministry', isHead: 1 },
      { username: 'men_lead', name: 'Farai Chidziva', section: 'Men\'s Fellowship', isHead: 1 }
    ];

    const leaderMap = {};
    for (const l of leadersToCreate) {
      const user = await run('INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)', 
        [l.username, leaderPassword, 'leader', l.name]);
      const leader = await run('INSERT INTO leaders (user_id, section_id, is_head, phone, email) VALUES (?, ?, ?, ?, ?)', 
        [user.lastID, sectionIds[l.section], l.isHead, '+263 77 000 0000', `${l.username}@church.org`]);
      leaderMap[l.section] = { id: leader.lastID, userId: user.lastID, name: l.name };
    }
    console.log(`✅ Created ${leadersToCreate.length} leaders`);

    // 5. Create Members with Eligibility Data
    const members = [
      // Youth Members
      { name: 'Blessing Moyo', gender: 'Female', age: 19, section: 'Youth Ministry', leader: 'Youth Ministry' },
      { name: 'Kudzi Mutasa', gender: 'Male', age: 16, section: 'Youth Ministry', leader: 'Youth Ministry' },
      { name: 'Tinashe Gumbo', gender: 'Male', age: 24, section: 'Youth Ministry', leader: 'Youth Ministry' },
      { name: 'Ropafadzo Chidziva', gender: 'Female', age: 21, section: 'Youth Ministry', leader: 'Youth Ministry' },
      
      // Women members
      { name: 'Chipo Mutasa', gender: 'Female', age: 34, section: 'Women\'s Ministry', leader: 'Women\'s Ministry' },
      { name: 'Nyasha Ncube', gender: 'Female', age: 42, section: 'Women\'s Ministry', leader: 'Women\'s Ministry' },
      { name: 'Rudo Mhlanga', gender: 'Female', age: 29, section: 'Women\'s Ministry', leader: 'Women\'s Ministry' },
      
      // Worship Team
      { name: 'Tendai Moyo', gender: 'Male', age: 31, section: 'Worship Team', leader: 'Worship Team' },
      { name: 'Nyasha Chikwanha', gender: 'Female', age: 27, section: 'Worship Team', leader: 'Worship Team' }
    ];

    let membershipIdCounter = 2000;
    for (const m of members) {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - m.age);
      const dobStr = dob.toISOString().split('T')[0];

      await run(
        `INSERT INTO members (membership_id, full_name, section_id, leader_id, gender, date_of_birth, age_group, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          String(membershipIdCounter++), 
          m.name, 
          sectionIds[m.section], 
          leaderMap[m.leader].id, 
          m.gender, 
          dobStr, 
          m.age < 26 ? '18-25' : '26-35'
        ]
      );
    }
    console.log(`✅ Created ${members.length} members with DOBs and Section IDs`);

    // 6. Populate some Attendance/History
    const dates = [];
    const today = new Date();
    for(let i=0; i<4; i++) {
       const d = new Date(today);
       d.setDate(d.getDate() - (i*7));
       dates.push(d.toISOString().split('T')[0]);
    }

    for (const date of dates) {
      for (const sectionName of Object.keys(leaderMap)) {
        const leader = leaderMap[sectionName];
        const sectionId = sectionIds[sectionName];
        
        await run('INSERT INTO submission_log (leader_id, section_id, date, service_id) VALUES (?, ?, ?, ?)', 
          [leader.id, sectionId, date, 1]);

        const sectionMembers = await all('SELECT id FROM members WHERE section_id = ?', [sectionId]);
        for (const m of sectionMembers) {
          await run('INSERT INTO attendance (member_id, date, status, service_type_id, submitted_by) VALUES (?, ?, ?, ?, ?)', 
            [m.id, date, Math.random() > 0.2 ? 'present' : 'absent', 1, leader.userId]);
        }
      }
    }
    console.log('✅ Generated 4 weeks of Main Service history');

    console.log('\n🎉 SUCCESS: Database reset and seeded!');
    console.log('------------------------------');
    console.log('Leader Account: youth_lead');
    console.log('Password: leader123');
    console.log('Expected Youth Roster: 4 members');
    console.log('------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('❌ SEED ERROR:', error);
    process.exit(1);
  }
}

seed();
