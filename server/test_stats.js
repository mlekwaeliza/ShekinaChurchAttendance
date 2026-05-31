const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

const queries = {
  getTodayAttendanceStats: (serviceId = 1) => {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
          SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused
        FROM attendance
        WHERE date = date('now')
        AND (service_type_id = ? OR ? = 'all')
      `, [serviceId, serviceId], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
  }
};

queries.getTodayAttendanceStats(1).then(stats => {
  console.log('Today Stats:', stats);
  db.close();
});
