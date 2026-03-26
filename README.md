# Church Attendance Tracking System

A professional web application for managing church member attendance through sections. Designed for pastors, section leaders, and administrators.

## Features

- **Admin Dashboard**: Upload CSV, manage members, modify attendance, export reports
- **Leader Portal**: Login, view assigned members, mark attendance weekly (present/absent/excused)
- **Pastor Dashboard**: Real-time analytics, attendance trends, leader performance metrics, at-risk member identification
- **Responsive Design**: Works on desktop and mobile devices
- **Role-based Authentication**: Secure login for Admin, Leaders, and Pastor
- **CSV Import**: Bulk upload member data with sections and leader assignments

## Quick Start

### Prerequisites
- Node.js 16+ and npm

### Installation

1. **Install dependencies** (from project root):
```bash
npm run install-all
```

This installs dependencies for both server and client.

2. **Configure environment**:
```bash
cp .env.example server/.env
```
Edit `server/.env` and set:
- `SESSION_SECRET`: Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `NODE_ENV`: `development` or `production`

3. **Start the application**:
```bash
# In two terminals, or use:
npm start
```

This runs:
- Backend: http://localhost:3001
- Frontend: http://localhost:3000

4. **Initial Login**:
   - Username: `admin`
   - Password: `admin123`
   - **IMPORTANT**: Change the admin password after first login! (Currently password change not implemented - see TODO)

## CSV Format

Upload a CSV file with these columns:
```
MembershipID,FullName,Section,LeaderName,Phone,Email,Gender,AgeGroup
```

**Important**:
- `Section` must match exactly: "Holy Spirit", "Divine of God", "Glory of God", "Love of God"
- `LeaderName` will be used to create a leader account (first occurrence)
- `MembershipID` must be unique for each member
- Phone and Email are optional
- Gender and AgeGroup are optional for demographics

**Sample CSV**: See `data/sample.csv`

## User Roles

### Administrator
- Access: `/admin`
- Capabilities:
  - Upload CSV with member data
  - View all members (with search)
  - Edit/delete members
  - Modify any attendance record
  - Export attendance data as CSV
  - View sections and leaders

### Section Leader
- Access: `/leader`
- Capabilities:
  - See all members assigned to their section
  - Select date and mark attendance for each member
  - Submit once per Sunday (locked after submission)
  - View personal submission history
- Note: Leader accounts are created automatically during CSV upload

### Pastor
- Access: `/pastor`
- Capabilities:
  - View overall attendance statistics
  - Charts and trends over time
  - Leader performance metrics
  - At-risk members (3+ absences in 30 days)
  - Filter by date range
  - Export reports

## Database Schema

Using SQLite with the following tables:

- `users` - User accounts (username, password, role)
- `sections` - Section names
- `leaders` - Leaders linked to users and sections
- `members` - Member details with section and leader assignments
- `attendance` - Attendance records (one per member per date)
- `submission_log` - Prevents duplicate submissions by leader per date

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Check session

### Admin (`/api/admin/*`)
- `GET /sections` - List sections
- `POST /sections` - Create section
- `GET /members` - List members (filters: section_id, leader_id, membership_id)
- `PUT /members/:id` - Update member
- `DELETE /members/:id` - Delete member
- `POST /upload-csv` - Upload CSV
- `GET /attendance` - List attendance (filters: date, section_id, leader_id)
- `PUT /attendance/:id` - Update attendance (admin override)
- `GET /export` - Export CSV
- `GET /leaders` - List leaders

### Leader (`/api/leader/*`)
- `GET /members` - Get assigned members
- `GET /attendance/:date` - Check submission status for date
- `POST /attendance` - Submit bulk attendance
- `GET /history` - View past submissions

### Pastor (`/api/pastor/*`)
- `GET /dashboard/stats` - Overview statistics
- `GET /dashboard/trends` - Time series data for charts
- `GET /leaders/metrics` - Leader performance
- `GET /members/at-risk` - Members with 3+ absences
- `GET /members/:id/history` - Member attendance history

## Project Structure

```
.
├── client/                 # React frontend
│   ├── public/
│   └── src/
│       ├── components/    # Layout, etc.
│       ├── context/       # AuthContext
│       ├── pages/         # Login, AdminDashboard, LeaderDashboard, PastorDashboard
│       ├── services/      # API calls
│       └── App.js
├── server/                 # Express backend
│   ├── routes/            # auth, admin, leader, pastor
│   ├── middleware/        # auth middleware
│   ├── database.js        # SQLite setup and queries
│   └── server.js          # Express app
├── data/
│   └── sample.csv         # Sample data
├── package.json           # Root (workspaces)
├── .env.example
└── README.md
```

## Deployment

### Heroku / Railway
1. Push to Git repository
2. Add buildpack for Node.js
3. Set environment variables
4. Deploy

### VPS / Dedicated Server
1. Copy files to server
2. Run `npm ci --only=production`
3. Configure nginx as reverse proxy
4. Set up SSL (Let's Encrypt)
5. Use PM2 for process management: `pm2 start server/server.js`

### Local Production
```bash
NODE_ENV=production npm start
```

## Security Considerations

- Default admin credentials should be changed immediately
- Use strong `SESSION_SECRET` in production
- Enable HTTPS in production (set `cookie.secure: true`)
- Database file should be backed up regularly
- Implement password reset functionality (TODO)
- Add CSRF protection (TODO)
- Implement rate limiting on auth endpoints (partial: rate limit on all API)

## Future Enhancements (TODO)

- Password reset functionality
- Email notifications for absences
- Mobile app (React Native)
- Bulk member editing
- Advanced reporting (PDF generation)
- Attendance prediction insights
- SMS integration for follow-ups
- Multi-language support
- Recurring service times management

## Troubleshooting

**Database locked errors**: Ensure only one server instance is running. Delete `server/database.sqlite-wal` and `server/database.sqlite-shm` if present, then restart.

**CORS errors**: Ensure client URL matches `CLIENT_URL` in `.env`.

**CSV upload fails**: Check CSV headers match exactly. Use `data/sample.csv` as template.

**Session issues**: Clear browser cookies and restart server.

## License

This project is provided as-is for church use.

## Support

For issues, check browser console and server logs for error messages.
