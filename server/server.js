const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { csrfProtect } = require('./middleware/csrf');
const { auditLog } = require('./middleware/audit');
const { addDays, formatLocalDate, startOfLocalDay } = require('./utils/date');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const { queries, db, all, ensureAttendanceServiceUniqueness, ensureHomeCellSchema } = require('./database');
const { backupDatabase } = require('./backup');
const { startScheduler } = require('./scheduler');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const leaderRoutes = require('./routes/leader');
const outreachRoutes = require('./routes/outreach');
const pastorRoutes = require('./routes/pastor');
const twofactorRoutes = require('./routes/twofactor');
const analyticsRoutes = require('./routes/analytics');
const birthdayRoutes = require('./routes/birthdays');
const calendarRoutes = require('./routes/calendar');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const dbClient = String(process.env.DB_CLIENT || 'sqlite').toLowerCase();
const trustProxy = String(process.env.TRUST_PROXY || '').toLowerCase() === 'true';
const cookieSecure = isProduction || String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
const clientUrl = process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';

if (trustProxy) {
  app.set('trust proxy', 1);
}

const isLocalRequest = (req) => {
  const ip = req.ip || req.connection?.remoteAddress || '';
  const origin = req.get('origin') || '';
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('http://localhost:')
  );
};

// Security middleware
app.use(helmet());
app.use(cors({
  origin: clientUrl,
  credentials: true
}));

// Rate limiting - general
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // allow normal dashboard navigation while login remains strictly limited
  skip: isLocalRequest
});
app.use('/api/', limiter);

// Stricter rate limiting for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per window
  message: { error: 'Too many login attempts, please try again later' },
  skip: isLocalRequest
});

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser (needed for CSRF token validation)
app.use(cookieParser());

// Session configuration
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.error('ERROR: SESSION_SECRET environment variable is not set.');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

const sessionConfig = {
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: cookieSecure,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

if (dbClient === 'postgres') {
  const PgSession = require('connect-pg-simple')(session);
  const { pool } = require('./db/postgres');
  sessionConfig.store = new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  });
}

app.use(session(sessionConfig));

// CSRF Protection (for authenticated state-changing requests)
app.use('/api/', csrfProtect());

// Audit logging for state-changing requests
app.use('/api/', auditLog);

app.use('/api/', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// API Routes
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leader', leaderRoutes);
app.use('/api/pastor', pastorRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/2fa', twofactorRoutes);
app.use('/api/birthdays', birthdayRoutes);
app.use('/api/outreach', outreachRoutes);
app.use('/api/calendar', calendarRoutes);

// Static uploads serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve production client build
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('sw.js') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// Health check
app.get('/api/health', async (req, res) => {
  const uptime = process.uptime();
  const memory = {
    rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
  };

  if (dbClient === 'postgres') {
    try {
      const { checkConnection } = require('./db/postgres');
      const check = await checkConnection();
      return res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        database: {
          client: 'postgres',
          status: 'connected',
          latency_ms: check.latency_ms,
          name: check.database,
          user: check.user
        },
        memory
      });
    } catch (err) {
      return res.json({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        database: {
          client: 'postgres',
          status: 'error',
          error: err.message
        },
        memory
      });
    }
  }

  const dbPath = require('path').join(__dirname, 'database.sqlite');
  const dbSize = require('fs').existsSync(dbPath) ? Math.round(require('fs').statSync(dbPath).size / 1024) : 0;

  db.get('SELECT 1', (err) => {
    res.json({
      status: err ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      database: {
        client: 'sqlite',
        size_kb: dbSize,
        status: err ? 'error' : 'connected'
      },
      memory
    });
  });
});

// 404 catch-all for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// SPA fallback - serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

// Initialize default admin if not exists
async function initializeAdmin() {
  try {
    const adminExists = await queries.findUserByUsername('admin');
    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      const crypto = require('crypto');
      const tempPassword = crypto.randomBytes(8).toString('hex');
      const passwordHash = bcrypt.hashSync(tempPassword, 10);
      await queries.createUser('admin', passwordHash, 'admin', 'System Administrator');
      console.log('Default admin user created');
      console.log('Username: admin');
      console.log(`Temporary password: ${tempPassword}`);
      console.log('IMPORTANT: Change this password after first login!');
    }
  } catch (error) {
    console.error('Failed to create admin user:', error);
  }
}

async function generateNotifications() {
  try {
    const todayStart = startOfLocalDay(new Date());
    const yesterdayStart = addDays(todayStart, -1);
    const yesterdayStr = formatLocalDate(yesterdayStart);
    const yesterdayWindowStart = yesterdayStart.toISOString();
    const yesterdayWindowEnd = todayStart.toISOString();
    const missedLeaders = [];

    const leaders = await all(`
      SELECT l.id, l.section_id, l.user_id, s.name as section_name, u.full_name
      FROM leaders l
      JOIN users u ON l.user_id = u.id
      JOIN sections s ON l.section_id = s.id
    `);

    for (const leader of leaders) {
      const submission = await all(
        'SELECT id FROM submission_log WHERE leader_id = ? AND date = ?',
        [leader.id, yesterdayStr]
      );

      if (submission.length === 0) {
        missedLeaders.push(leader);
        const existing = await all(
          'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND entity_type = ? AND created_at >= ? AND created_at < ?',
          [leader.user_id, 'missed_submission', 'leader', yesterdayWindowStart, yesterdayWindowEnd]
        );
        if (existing.length === 0) {
          await queries.createNotification(
            leader.user_id,
            'missed_submission',
            'Missed Submission',
            `No attendance submitted for ${leader.section_name} on ${yesterdayStr}`,
            'leader',
            leader.id
          );
        }
      }
    }

    const admins = await all("SELECT id FROM users WHERE role = 'admin'");

    if (admins.length > 0) {
      const adminId = admins[0].id;
      const existingAdmin = await all(
        'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND created_at >= ? AND created_at < ?',
        [adminId, 'missed_submission', yesterdayWindowStart, yesterdayWindowEnd]
      );
      if (existingAdmin.length === 0) {
        await queries.createNotification(
          adminId,
          'missed_submission',
          'Leaders Missing Submissions',
          `${missedLeaders.length} leader(s) did not submit attendance for ${yesterdayStr}`,
          null,
          null
        );
      }
    }

    console.log('Notification check completed');
  } catch (error) {
    console.error('Notification generation error:', error);
  }
}

// Start server
async function startServer() {
  try {
    await new Promise((resolve, reject) => {
      require('./database').db.get('SELECT 1', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Database connection established');
    await ensureAttendanceServiceUniqueness();
    await ensureHomeCellSchema();
    await initializeAdmin();
    await generateNotifications();
    setInterval(generateNotifications, 24 * 60 * 60 * 1000);
    startScheduler();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('FATAL: Failed to connect to database:', error.message);
    console.error('Please check that the database file exists and is not corrupted.');
    console.error('If corrupted, delete server/database.sqlite and restart.');
    process.exit(1);
  }
}

startServer();

module.exports = app;
