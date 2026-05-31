const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.all("SELECT DISTINCT date, strftime('%Y-%W', date) as sqlite_week FROM attendance ORDER BY date DESC LIMIT 10", (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
