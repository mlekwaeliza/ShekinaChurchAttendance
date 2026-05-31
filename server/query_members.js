const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all("SELECT * FROM members LIMIT 1", [], (err, rows) => {
    if (err) {
      console.error(err.message);
      process.exit(1);
    }
    if (rows.length === 0) {
      console.log("No members found, but here is the table info:");
      db.all("PRAGMA table_info(members)", [], (err, info) => {
        if (err) {
          console.error(err.message);
        } else {
          console.log(JSON.stringify(info, null, 2));
        }
        db.close();
      });
    } else {
      console.log(JSON.stringify(rows[0], null, 2));
      db.close();
    }
  });
});
