const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.all("SELECT l.*, u.full_name FROM leaders l JOIN users u ON l.user_id = u.id WHERE l.is_head = 1", (err, leaders) => {
  if (err) throw err;
  
  leaders.forEach(leader => {
    db.get("SELECT id FROM members WHERE full_name = ?", [leader.full_name], (err, member) => {
      if (err) throw err;
      if (!member) {
        console.log(`Adding Head Leader ${leader.full_name} to members...`);
        const sql = `INSERT INTO members (membership_id, full_name, section_id, leader_id, gender, status, is_active, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`;
        db.run(sql, [`LDR-${leader.id}`, leader.full_name, leader.section_id, leader.id, 'Other', 'Active', 1]);
      } else {
        console.log(`Head Leader ${leader.full_name} already in members.`);
      }
    });
  });
});
