const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');
const bcrypt = require('bcryptjs');

db.get("SELECT * FROM users WHERE username='elizabeth_nehemiah'", (err, row) => {
    if (err) console.error(err);
    if (!row) {
        console.log("User not found!");
    } else {
        console.log(row);
        const newPassword = 'password123';
        const hash = bcrypt.hashSync(newPassword, 10);
        db.run("UPDATE users SET password_hash=?, failed_login_attempts=0, locked_until=NULL WHERE id=?", [hash, row.id], (err) => {
            if (err) console.error(err);
            else console.log("Password reset successfully to 'password123'");
        });
    }
});
