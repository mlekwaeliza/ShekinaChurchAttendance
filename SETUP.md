# Setup Guide

Follow these steps to get the Church Attendance System running.

## 1. Install Dependencies

From the project root, run:

```bash
npm install
npm run install-all
```

This installs packages for both client and server.

## 2. Configure Environment

```bash
cp .env.example server/.env
```

Edit `server/.env`:

```env
PORT=3001
NODE_ENV=development
SESSION_SECRET=<generate-a-random-secret>
CLIENT_URL=http://localhost:3000
```

To generate a secure `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Initialize Database

The database (`database.sqlite`) is created automatically when the server starts.

To create the default admin user:

```bash
node scripts/seed-admin.js
```

## 4. Start Application

**Development mode** (runs both server and client):

```bash
npm start
```

Or run separately:

```bash
# Terminal 1 - Backend
cd server
npm start

# Terminal 2 - Frontend
cd client
npm start
```

Access the app:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## 5. Initial Login

Default admin credentials:
- **Username:** `admin`
- **Password:** `admin123`

⚠️ **Important:** After first login, you should change the admin password (not yet implemented in UI - change in database directly or implement password change).

## 6. Upload CSV Data

1. Log in as admin
2. Click "Upload CSV" tab
3. Prepare your CSV file with columns:
   ```
   MembershipID,FullName,Section,LeaderName,Phone,Email,Gender,AgeGroup
   ```
4. Supported sections (exact match required):
   - Holy Spirit
   - Divine of God
   - Glory of God
   - Love of God
5. Upload the file

Leader accounts will be created automatically based on `LeaderName`.

## 7. Leader Login

After CSV upload:
- Each unique `LeaderName` creates a leader account
- Password: `temp_<random8chars>` (shown in upload response)
- Leaders must use these temporary passwords and should be instructed to change them

## 8. Taking Attendance (Leaders)

1. Leader logs in
2. Click "Take Attendance"
3. Select Sunday date
4. Set status (Present/Absent/Excused) for each member
5. Click "Submit Attendance"
6. Cannot submit again for same date

## 9. View Analytics (Pastor)

1. Log in with pastor account (create manually in database):
   ```sql
   INSERT INTO users (username, password_hash, role, full_name) VALUES ('pastor', '<hashed-password>', 'pastor', 'Senior Pastor');
   ```
2. Access `/pastor` routes
3. View stats, trends, leader metrics, at-risk members
4. Export data as CSV

## Troubleshooting

**Database errors:**
- Check file permissions on `server/database.sqlite`
- Delete `database.sqlite-wal` and `database.sqlite-shm` if present

**CSV upload fails:**
- Verify headers match sample in `data/sample.csv`
- Check browser console and server logs
- Ensure all required columns present

**Cannot login:**
- Run `scripts/seed-admin.js` to recreate admin
- Check server logs for errors

**Port already in use:**
- Change PORT in `.env`
- Or kill process on port: `lsof -ti:3001 | xargs kill -9` (macOS/Linux)

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Generate strong `SESSION_SECRET`
3. Use process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start server/server.js --name "church-attendance"
   ```
4. Set up nginx reverse proxy
5. Enable HTTPS (Let's Encrypt)

## Sample Data

Use `data/sample.csv` as a template. It contains 113 members across 4 sections with 20+ leader assignments.
