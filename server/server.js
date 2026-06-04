// dotenv MUST be loaded before any module that reads process.env at top
// level (notably ./database which picks the PG vs SQLite driver). All
// other requires are deferred until after env is populated.
require('dotenv').config();

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
const crypto = require('crypto');
const onFinished = require('on-finished');

// Optional Sentry init. No-op unless SENTRY_DSN is set.
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.GIT_SHA || undefined,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
      // Don't capture PII automatically.
      sendDefaultPii: false,
      beforeSend(event) {
        // Strip Authorization header from breadcrumbs.
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        return event;
      }
    });
  } catch (err) {
    console.warn('Sentry init failed (continuing without):', err.message);
  }
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const { queries, db, all, ensureHomeCellSchema } = require('./database');
const { backupDatabase } = require('./backup');
const { startScheduler } = require('./scheduler');
const authRoutes = require('./routes/auth');
const adminAttendanceRoutes = require('./routes/adminAttendance');
const adminHomeCellRoutes = require('./routes/adminHomeCells');
const adminRoutes = require('./routes/admin');
const leaderRoutes = require('./routes/leader');
const outreachRoutes = require('./routes/outreach');
const pastorRoutes = require('./routes/pastor');
const twofactorRoutes = require('./routes/twofactor');
const analyticsRoutes = require('./routes/analytics');
const birthdayRoutes = require('./routes/birthdays');
const calendarRoutes = require('./routes/calendar');
const eventsRoutes = require('./realtime/events');
const realtimeBus = require('./realtime/bus');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const trustProxy = String(process.env.TRUST_PROXY || '').toLowerCase() === 'true';
const cookieSecure = isProduction || String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
const clientUrl = process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';

if (trustProxy) {
  app.set('trust proxy', 1);
}

const isLocalRequest = (req) => {
  const ip = req.ip || req.connection?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: isProduction
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: []
        }
      }
    : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  hsts: isProduction
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  referrerPolicy: { policy: 'same-origin' }
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin (no Origin header) and configured client origin
    if (!origin || origin === clientUrl) return callback(null, true);
    return callback(new Error('CORS: origin not allowed'));
  },
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

// Per-IP failed-login counter (in-memory). Complements the per-account
// 5-attempts lockout by protecting against credential-stuffing
// distributed across many usernames from a single source IP.
const ipLoginFailures = new Map();
const IP_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const IP_LOGIN_MAX = 25;
function getIpLoginState(ip) {
  const now = Date.now();
  const state = ipLoginFailures.get(ip);
  if (!state || now - state.startedAt > IP_LOGIN_WINDOW_MS) {
    return { count: 0, startedAt: now, lockedUntil: 0 };
  }
  return state;
}
function recordIpLoginFailure(ip) {
  const now = Date.now();
  const state = ipLoginFailures.get(ip);
  if (!state || now - state.startedAt > IP_LOGIN_WINDOW_MS) {
    ipLoginFailures.set(ip, { count: 1, startedAt: now, lockedUntil: 0 });
    return;
  }
  state.count += 1;
  if (state.count >= IP_LOGIN_MAX) {
    state.lockedUntil = now + IP_LOGIN_WINDOW_MS;
  }
}
function resetIpLoginState(ip) {
  ipLoginFailures.delete(ip);
}
setInterval(() => {
  const cutoff = Date.now() - IP_LOGIN_WINDOW_MS;
  for (const [ip, state] of ipLoginFailures.entries()) {
    if (state.startedAt < cutoff && (!state.lockedUntil || state.lockedUntil < Date.now())) {
      ipLoginFailures.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref?.();

// Compression (skip /api/metrics and SSE streams which are text/event-stream)
app.use(require('compression')({
  threshold: 1024,
  level: 6
}));

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

function buildSessionStore() {
  const dbClient = String(process.env.DB_CLIENT || 'sqlite').toLowerCase();
  if (dbClient === 'postgres') {
    const PgSession = require('connect-pg-simple')(session);
    const { pool } = require('./db/postgres');
    return new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15 // seconds
    });
  }
  return undefined; // default MemoryStore (OK for local SQLite dev only)
}

app.use(session({
  name: 'sc.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: buildSessionStore(),
  cookie: {
    secure: cookieSecure,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours idle timeout
  }
}));

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

// Request ID + structured access log
app.use((req, res, next) => {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  const start = process.hrtime.bigint();
  onFinished(res, () => {
    const durMs = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(JSON.stringify({
      level: 'info',
      type: 'http',
      request_id: id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Math.round(durMs * 100) / 100,
      ip: req.ip,
      user_id: req.session?.userId || null
    }));
  });
  next();
});

// API Routes
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminAttendanceRoutes);
app.use('/api/admin', adminHomeCellRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leader', leaderRoutes);
app.use('/api/pastor', pastorRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/2fa', twofactorRoutes);
app.use('/api/birthdays', birthdayRoutes);
app.use('/api/outreach', outreachRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/events', eventsRoutes);

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
  const dbClient = String(process.env.DB_CLIENT || 'sqlite').toLowerCase();
  const memory = {
    rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
  };

  if (dbClient === 'postgres') {
    try {
      const { checkConnection, pool } = require('./db/postgres');
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
          user: check.user,
          pool: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount
          }
        },
        memory,
        realtime: realtimeBus.stats(),
        node: {
          version: process.version,
          env: process.env.NODE_ENV || 'development'
        }
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

// Prometheus-style metrics endpoint. No external dep; just process metrics
// + DB connection status. Format: text/plain; version=0.0.4
app.get('/api/metrics', async (req, res) => {
  const mem = process.memoryUsage();
  const dbClient = String(process.env.DB_CLIENT || 'sqlite').toLowerCase();
  let dbUp = 0;
  if (dbClient === 'postgres') {
    try {
      const { checkConnection } = require('./db/postgres');
      const r = await checkConnection();
      dbUp = r.ok ? 1 : 0;
    } catch (e) { dbUp = 0; }
  } else {
    dbUp = 1; // SQLite is process-local; assume up
  }
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send([
    '# HELP process_uptime_seconds Node process uptime in seconds',
    '# TYPE process_uptime_seconds gauge',
    `process_uptime_seconds ${process.uptime()}`,
    '# HELP process_resident_memory_bytes RSS in bytes',
    '# TYPE process_resident_memory_bytes gauge',
    `process_resident_memory_bytes ${mem.rss}`,
    '# HELP process_heap_bytes Heap used in bytes',
    '# TYPE process_heap_bytes gauge',
    `process_heap_bytes ${mem.heapUsed}`,
    '# HELP database_up 1 if database is reachable, else 0',
    '# TYPE database_up gauge',
    `database_up{client="${dbClient}"} ${dbUp}`
  ].join('\n'));
});
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
      const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
      if (initialPassword && initialPassword.length >= 12) {
        const passwordHash = bcrypt.hashSync(initialPassword, 10);
        await queries.createUser('admin', passwordHash, 'admin', 'System Administrator');
        console.log('Default admin user created from INITIAL_ADMIN_PASSWORD env var.');
      } else {
        console.warn('No admin user exists. Set INITIAL_ADMIN_PASSWORD (>=12 chars) and restart to bootstrap.');
        console.warn('Admin login will be unavailable until this is configured.');
      }
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
let server = null;
async function startServer() {
  try {
    await new Promise((resolve, reject) => {
      require('./database').db.get('SELECT 1', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Database connection established');
    await ensureHomeCellSchema();
    await initializeAdmin();
    await generateNotifications();
    setInterval(generateNotifications, 24 * 60 * 60 * 1000);
    startScheduler();
    // Start the Postgres LISTEN/NOTIFY bridge for cross-instance SSE
    // delivery. No-op when DATABASE_URL is unset (e.g. SQLite mode).
    const busBridge = require('./realtime/bridge');
    busBridge.startBridge().catch((err) => {
      console.warn('Realtime bridge failed to start:', err.message);
    });
    server = app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
      console.log(`Server running on ${process.env.HOST || '0.0.0.0'}:${PORT}`);
    });
  } catch (error) {
    console.error('FATAL: Failed to connect to database:', error.message);
    console.error('Please check that the database file exists and is not corrupted.');
    console.error('If corrupted, delete server/database.sqlite and restart.');
    process.exit(1);
  }
}

// Graceful shutdown
let shuttingDown = false;
function shutdown(signal) {
  return async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ level: 'info', type: 'shutdown', signal }));
    const forceExit = setTimeout(() => {
      console.error('Forced exit after 15s');
      process.exit(1);
    }, 15000);
    forceExit.unref();

    try {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
      // Stop the realtime bridge BEFORE closing the pool so the LISTEN
      // client can cleanly end its connection.
      try { await require('./realtime/bridge').stopBridge(); } catch (_) { /* noop */ }
      const dbClient = String(process.env.DB_CLIENT || 'sqlite').toLowerCase();
      if (dbClient === 'postgres') {
        const { close } = require('./db/postgres');
        await close();
      }
      clearTimeout(forceExit);
      process.exit(0);
    } catch (err) {
      console.error('Shutdown error:', err);
      process.exit(1);
    }
  };
}

process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({ level: 'error', type: 'unhandledRejection', reason: String(reason) }));
});
process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({ level: 'error', type: 'uncaughtException', message: err.message, stack: err.stack }));
  shutdown('uncaughtException')();
});

startServer();

module.exports = app;
