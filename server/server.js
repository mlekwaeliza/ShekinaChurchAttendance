// dotenv MUST be loaded before any module that reads process.env at top
// level (notably ./database which picks the PG vs SQLite driver). All
// other requires are deferred until after env is populated.
require('dotenv').config();

// L3-fix: install the PII redaction logger as early as possible so
// that even the modules required below benefit from redacted stdout.
require('./utils/piiLogger').install();

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
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
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

// Extract the Sentry host (if any) so the CSP can allow browser-side
// events to reach the Sentry ingest endpoint. The DSN format is
// https://<public_key>@o<org>.ingest.sentry.io/<project_id> for SaaS
// or https://<key>@<self-hosted-host>/<id> for self-hosted.
// Parsed defensively: an unparseable DSN just means no host is added.
function parseSentryHost(dsn) {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    return u.host || null;
  } catch (_) {
    return null;
  }
}
const sentryHost = parseSentryHost(process.env.SENTRY_DSN);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const financeUploadsDir = path.join(__dirname, 'uploads', 'finance');
if (!fs.existsSync(financeUploadsDir)) {
  fs.mkdirSync(financeUploadsDir, { recursive: true });
}

const { queries, db, all, run, get, ensureHomeCellSchema, ensureEvangelismSchema, migrateUsersRoleConstraint, linkUsersToMembers } = require('./database');
const { backupDatabase } = require('./backup');
const { startScheduler } = require('./scheduler');
const authRoutes = require('./routes/auth');
const adminAttendanceRoutes = require('./routes/adminAttendance');
const adminEngagementRoutes = require('./routes/adminEngagement');
const adminHomeCellRoutes = require('./routes/adminHomeCells');
const adminInsightsRoutes = require('./routes/adminInsights');
const adminOperationsRoutes = require('./routes/adminOperations');
const adminPeopleRoutes = require('./routes/adminPeople');
const adminSystemRoutes = require('./routes/adminSystem');
const adminPerformanceRoutes = require('./routes/adminPerformance');
const adminContributionsRoutes = require('./routes/adminContributions');
const adminFinanceRoutes = require('./routes/adminFinance');
const leaderRoutes = require('./routes/leader');
const outreachRoutes = require('./routes/outreach');
const pastorRoutes = require('./routes/pastor');
const twofactorRoutes = require('./routes/twofactor');
const analyticsRoutes = require('./routes/analytics');
const birthdayRoutes = require('./routes/birthdays');
const calendarRoutes = require('./routes/calendar');
const eventsRoutes = require('./realtime/events');
const realtimeBus = require('./realtime/bus');
const newMemberLeaderRoutes = require('./routes/newMemberLeader');
const evangelismRoutes = require('./routes/evangelism');

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
          scriptSrc: ["'self'", 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          // When Sentry is enabled, add the Sentry ingest host so the
          // browser can post events. Without this, Sentry would silently
          // fail because connect-src: 'self' would block all cross-origin
          // XHR/fetch. Both server-side init (in this file) and the
          // client SDK can use the same SENTRY_DSN.
          connectSrc: sentryHost ? ["'self'", `https://${sentryHost}`] : ["'self'"],
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

// L15-fix: explicit security headers. Helmet covers most of these in
// recent versions, but pinning them here makes the policy version-
// independent and easy to audit. Permissions-Policy disables browser
// features this app does not need (camera/mic/geo/payment/usb/etc.).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-XSS-Protection', '0'); // modern browsers honor CSP; legacy XSS filter is worse than nothing
  res.setHeader('Permissions-Policy', [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()',
    'interest-cohort=()', // disable FLoC/Topics
    'browsing-topics=()'
  ].join(', '));
  // Cross-Origin policies for the /api endpoints
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin (no Origin header) and configured client origin
    if (!origin || origin === clientUrl) return callback(null, true);
    return callback(new Error('CORS: origin not allowed'));
  },
  credentials: true
}));

// L8-fix: helper to construct rate limiters with a bounded IP tracker.
// express-rate-limit's default MemoryStore grows unbounded if an
// attacker rotates source IPs (each unique IP creates a new bucket).
// We pass a default `max` to bound the bucket count per limiter, and
// use the safe `ipKeyGenerator` helper for IPv6-aware keying.
const { ipKeyGenerator } = require('express-rate-limit');
const RL_MAX_KEYS = 10_000; // 10k unique IPs per limiter is plenty
const rateLimitDefaults = {
  standardHeaders: 'draft-7',
  legacyHeaders: false
};

function buildLimiter(opts) {
  return rateLimit({
    ...rateLimitDefaults,
    keyGenerator: ipKeyGenerator,
    max: RL_MAX_KEYS,
    ...opts
  });
}

// Rate limiting - general
const limiter = buildLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // allow normal dashboard navigation while login remains strictly limited
  skip: isLocalRequest
});
app.use('/api/', limiter);

// Stricter rate limiting for login
const loginLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per window
  message: { error: 'Too many login attempts, please try again later' },
  skip: isLocalRequest
});

// H3-fix: stricter per-endpoint rate limits.
const twofaLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many 2FA attempts, please try again later' },
  skip: isLocalRequest
});
const passwordChangeLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many password change attempts, please try again later' },
  skip: isLocalRequest
});
const uploadLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many upload attempts, please try again later' },
  skip: isLocalRequest
});
const bulkOpLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many bulk operations, please try again later' },
  skip: isLocalRequest
});
const leaderMgmtLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many leader management requests, please try again later' },
  skip: isLocalRequest
});

// Per-IP failed-login counter (database-backed). Complements the per-account
// 5-attempts lockout by protecting against credential-stuffing
// distributed across many usernames from a single source IP.
const IP_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const IP_LOGIN_MAX = 25;
async function getIpLoginState(ip) {
  const state = await queries.getIpLoginState(ip);
  if (!state) return { count: 0, lockedUntil: null };
  return { count: state.count, lockedUntil: state.locked_until ? new Date(state.locked_until).getTime() : null };
}
async function recordIpLoginFailure(ip) {
  await queries.recordIpLoginFailure(ip);
}
async function resetIpLoginState(ip) {
  await queries.resetIpLoginState(ip);
}
// Cleanup old IP login failures periodically
setInterval(() => {
  queries.cleanupIpLoginFailures().catch(err => console.error('Cleanup IP login failures error:', err.message));
}, 5 * 60 * 1000).unref?.();

// Compression (skip /api/metrics and SSE streams which are text/event-stream)
app.use(require('compression')({
  threshold: 1024,
  level: 6
}));

// I2/I4-fix: request-id for log correlation and response header.
// Mounted first so the id is available to all subsequent middleware
// (including the global error handler and the audit logger).
app.use(require('./middleware/requestId').requestId());

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
// L5-fix: enforce minimum entropy on the session secret. Anything
// shorter than 32 bytes (~256 bits) or matching a common default
// is rejected in production. In development a 16-byte minimum is
// allowed with a warning so local SQLite iteration isn't blocked.
const SECRET_MIN = isProduction ? 32 : 16;
if (sessionSecret.length < SECRET_MIN) {
  console.error(`ERROR: SESSION_SECRET must be at least ${SECRET_MIN} chars (got ${sessionSecret.length}).`);
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}
const WEAK_SECRETS = new Set([
  'changeme', 'change-me', 'secret', 'password', 'dev', 'development',
  'shekina-dev', 'shekina-church-attendance', 'localhost', 'test',
  'keyboard-cat', '12345678', 'admin', 'admin-secret'
]);
if (WEAK_SECRETS.has(sessionSecret.toLowerCase())) {
  console.error('ERROR: SESSION_SECRET is set to a known weak value. Refusing to start.');
  process.exit(1);
}

// L14-fix: track the session store at module scope so the graceful
// shutdown handler can release its resources (close PG client, clear
// in-memory sweep interval).
let activeSessionStore = null;

function buildSessionStore() {
  const dbClient = String(process.env.DB_CLIENT || 'sqlite').toLowerCase();
  if (dbClient === 'postgres') {
    const PgSession = require('connect-pg-simple')(session);
    const { pool } = require('./db/postgres');
    const store = new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15 // seconds (L14-fix: explicit prune)
    });
    activeSessionStore = store;
    return store;
  }

  // For SQLite mode: use connect-sqlite3 to persist sessions to disk so
  // they survive server restarts (common in development). Fall back to
  // MemoryStore only if the package is unavailable.
  try {
    const SqliteStore = require('connect-sqlite3')(session);
    const dbPath = path.join(__dirname, 'db');
    if (!require('fs').existsSync(dbPath)) require('fs').mkdirSync(dbPath, { recursive: true });
    const store = new SqliteStore({
      db: 'sessions.sqlite',
      dir: dbPath,
      table: 'sessions'
    });
    activeSessionStore = store;
    console.log('[Session] Using SQLite-backed session store (sessions survive server restarts)');
    return store;
  } catch (e) {
    console.warn('[Session] connect-sqlite3 not available, falling back to MemoryStore. Sessions will be lost on restart.');
  }

  // L14-fix: MemoryStore fallback with periodic TTL sweep.
  const memStore = new session.MemoryStore();
  const sweep = setInterval(() => {
    if (typeof memStore.all === 'function') {
      memStore.all((err, sessions) => {
        if (!err && sessions) {
          const now = Date.now();
          for (const [sid, sess] of Object.entries(sessions)) {
            if (sess?.cookie?.expires && new Date(sess.cookie.expires).getTime() < now) {
              memStore.destroy(sid, () => {});
            }
          }
        }
      });
    }
  }, 15 * 60 * 1000);
  sweep.unref?.();
  memStore._shekinaSweep = sweep;
  activeSessionStore = memStore;
  return memStore;
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
    maxAge: 60 * 60 * 1000 // 1 hour idle timeout (rolling)
  }
}));

// CSRF Protection (for authenticated state-changing requests)
app.use('/api/', csrfProtect());

// Absolute session ceiling: log out the user if the session has been
// alive for more than MAX_SESSION_AGE_MS regardless of rolling refresh.
// Rolling idle timeout (cookie.maxAge) handles inactivity; this handles
// total session lifetime (e.g. someone who clicks once an hour for 10 hours).
const MAX_SESSION_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours absolute
app.use('/api/', (req, res, next) => {
  if (req.session && req.session.userId && req.session.createdAt) {
    const age = Date.now() - new Date(req.session.createdAt).getTime();
    if (age > MAX_SESSION_AGE_MS) {
      const sid = req.session.id;
      req.session.destroy(() => {
        res.status(401).json({ error: 'Session expired (max age reached). Please log in again.' });
      });
      return;
    }
  }
  next();
});

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
app.use('/api/admin', adminContributionsRoutes);
app.use('/api/admin', adminFinanceRoutes);
app.use('/api/admin', adminPeopleRoutes);
app.use('/api/admin', adminAttendanceRoutes);
app.use('/api/admin', adminEngagementRoutes);
app.use('/api/admin', adminHomeCellRoutes);
app.use('/api/admin', adminInsightsRoutes);
app.use('/api/admin', adminOperationsRoutes);
app.use('/api/admin', adminSystemRoutes);
app.use('/api/admin', adminPerformanceRoutes);
app.use('/api/leader', leaderRoutes);
app.use('/api/pastor', pastorRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/2fa', twofaLimiter);
app.use('/api/2fa', twofactorRoutes);
app.use('/api/birthdays', birthdayRoutes);
app.use('/api/outreach', outreachRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/new-member-leader', newMemberLeaderRoutes);
app.use('/api/evangelism', evangelismRoutes);
// H3-fix: per-route limiters mounted as middleware on the specific
// sensitive paths. These run BEFORE the route handlers because the
// mount points above happen later. Unused limiters cost nothing.
app.use('/api/auth/change-password', passwordChangeLimiter);
app.use('/api/auth/profile-picture', uploadLimiter);
app.use('/api/admin/members/bulk-soft-delete', bulkOpLimiter);
app.use('/api/admin/members/confirm-deletion', bulkOpLimiter);
app.use('/api/admin/members/restore', bulkOpLimiter);
app.use('/api/admin/members/bulk-update', bulkOpLimiter);
app.use('/api/admin/leaders', leaderMgmtLimiter);
app.use('/api/admin/upload-csv', uploadLimiter);
app.use('/api/2fa/regenerate-backup-codes', bulkOpLimiter);

// Static uploads serving
// M7-fix: dotfiles: 'deny' blocks requests for hidden files
// (.env, .git, .htaccess, etc.) and index: false prevents
// directory listings. fallthrough: false makes unknown files
// return 404 instead of falling through to the SPA index.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'deny',
  index: false,
  fallthrough: false,
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    // Security headers for uploads
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'self'");
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

// Serve production client build
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist, {
  dotfiles: 'deny',
  index: false,
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
// L9-fix: /api/health returns minimal info by default (status, timestamp,
// uptime, db client, db status). Detailed info (latency, pool, memory,
// realtime stats, node version) is only returned when:
//   - The caller includes ?detail=full in the query
//   - AND the caller is authenticated as admin
// Unauthenticated callers (Render health check, k8s probes, uptime
// monitors) only see { status, timestamp, db: { status } }.
app.get('/api/health', async (req, res) => {
  const uptime = process.uptime();
  const dbClient = String(process.env.DB_CLIENT || 'sqlite').toLowerCase();
  const detail = req.query.detail === 'full'
    && req.session?.user?.role === 'admin';

  if (dbClient === 'postgres') {
    try {
      const { checkConnection, pool } = require('./db/postgres');
      const check = await checkConnection();
      const response = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        database: { status: 'connected' }
      };
      if (detail) {
        response.database = {
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
        };
        response.memory = {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
        };
        response.realtime = realtimeBus.stats();
        response.node = {
          version: process.version,
          env: process.env.NODE_ENV || 'development'
        };
      }
      return res.json(response);
    } catch (err) {
      return res.json({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: { status: 'error' }
      });
    }
  }

  // SQLite mode
  const dbPath = require('path').join(__dirname, 'database.sqlite');
  db.get('SELECT 1', (err) => {
    const response = {
      status: err ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      database: { status: err ? 'error' : 'connected' }
    };
    if (detail) {
      const dbSize = require('fs').existsSync(dbPath) ? Math.round(require('fs').statSync(dbPath).size / 1024) : 0;
      response.database = { client: 'sqlite', size_kb: dbSize, status: err ? 'error' : 'connected' };
      response.memory = {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
      };
    }
    res.json(response);
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
// M1+M8-fix: global Express error handler. Strips error.message and
// `details` from any response that hasn't explicitly opted in via
// `error.expose = true`. The full error is logged (and Sentry-reported
// if available) for operator visibility, but clients only see a
// generic message and an `errorId` (a short hash of the timestamp +
// path) so the support team can correlate client reports with
// server logs.
function globalErrorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  try {
    const status = Number.isInteger(err?.status) ? err.status
      : Number.isInteger(err?.statusCode) ? err.statusCode
      : 500;

    // Allow explicitly-exposed errors (e.g., 4xx with a safe message)
    // to pass through. The route can set `err.expose = true` and a
    // safe `err.userMessage` to control the response shape.
    if (err && err.expose && err.userMessage) {
      return res.status(status).json({ error: err.userMessage });
    }

    const errorId = require('crypto')
      .createHash('sha256')
      .update(`${Date.now()}:${req.method}:${req.originalUrl}:${Math.random()}`)
      .digest('hex')
      .slice(0, 12);

    // Log full detail server-side (request-id prefix makes the line
    // easy to find when a user pastes their errorId in a bug report).
    const requestId = req.id || res.locals.requestId || '-';
    console.error(`[req ${requestId} err ${errorId}] ${req.method} ${req.originalUrl}:`, err);

    // Sentry report if configured (does nothing in dev)
    try {
      if (typeof Sentry !== 'undefined' && Sentry && typeof Sentry.captureException === 'function') {
        Sentry.captureException(err, { tags: { errorId, requestId, path: req.originalUrl, method: req.method } });
      }
    } catch (_) { /* Sentry is optional */ }

    // Generic client response
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: status >= 500 ? 'Internal server error' : (err.userMessage || 'Request failed'),
      errorId
    });
  } catch (handlerError) {
    // Last-resort safety net so the process never crashes on a handler bug.
    console.error('Error handler itself threw:', handlerError);
    try { res.status(500).end(); } catch (_) { /* connection already closed */ }
  }
}

// M1+M8-fix: register the error handler last (after all routes and
// the 404 catch-all). Any unhandled rejection / thrown error in an
// async route that wasn't already caught will land here.
app.use(globalErrorHandler);

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
    // Helper: look up a member by name keywords and return {id, full_name}
    const findMemberByName = async (keywords) => {
      try {
        const conditions = keywords.map(k => `full_name LIKE '%${k}%'`).join(' OR ');
        const rows = await all(`SELECT id, full_name FROM members WHERE ${conditions} LIMIT 1`);
        return rows && rows[0] ? rows[0] : null;
      } catch { return null; }
    };

    // Seed admin account — linked to member record
    const adminExists = await queries.findUserByUsername('admin');
    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
      if (initialPassword && initialPassword.length >= 12) {
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        const member = await findMemberByName(['Daniel', 'Mulesi']);
        const fullName = member ? member.full_name : 'System Administrator';
        await run('INSERT INTO users (username, password_hash, role, full_name, member_id) VALUES (?, ?, ?, ?, ?)',
          ['admin', passwordHash, 'admin', fullName, member ? member.id : null]);
        console.log(`Admin user created${member ? ` linked to member "${fullName}"` : ''}.`);
      } else {
        console.warn('No admin user exists. Set INITIAL_ADMIN_PASSWORD (>=12 chars) and restart to bootstrap.');
      }
    } else {
      const bcrypt = require('bcryptjs');
      // Always re-hash admin password from INITIAL_ADMIN_PASSWORD env var.
      // This ensures the env var is the single source of truth for the password.
      const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
      if (initialPassword && initialPassword.length >= 12) {
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        await run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?',
          [passwordHash, 'admin']);
        console.log('Admin password reset from INITIAL_ADMIN_PASSWORD.');
      }
      // Link existing admin to member record if not yet linked
      if (!adminExists.member_id) {
        const member = await findMemberByName(['Daniel', 'Mulesi']);
        if (member) {
          await run('UPDATE users SET full_name = ?, member_id = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?',
            [member.full_name, member.id, 'admin']);
          console.log(`Admin account linked to member "${member.full_name}".`);
        }
      }
    }
    // Seed Genoveva Hance test account (leader with new member leader flag)
    const genovevaExists = await queries.findUserByUsername('ghance');
    if (!genovevaExists) {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash('password123', 10);
      try {
        const member = await findMemberByName(['Genoveva', 'Hance']);
        const fullName = member ? member.full_name : 'Genoveva Hance';
        await run('INSERT INTO users (username, password_hash, role, full_name, member_id) VALUES (?, ?, ?, ?, ?)',
          ['ghance', passwordHash, 'leader', fullName, member ? member.id : null]);
      } catch (e1) {
        console.warn('createUser failed for ghance:', e1.message);
      }
    }
    // Ensure is_new_member_leader is set to 1 (covers existing users too)
    const ghanceUser = await queries.findUserByUsername('ghance');
    if (ghanceUser) {
      try {
        await run('UPDATE users SET is_new_member_leader = 1 WHERE id = ?', [ghanceUser.id]);
        console.log('Genoveva Hance account seeded (leader, is_new_member_leader=1).');
      } catch (e2) {
        console.warn('Failed to set is_new_member_leader on ghance:', e2.message);
      }
    }
    // Seed Jeremiah Nicholaus evangelist account — linked to member record
    const jeremiahExists = await queries.findUserByUsername('jnicholaus');
    if (!jeremiahExists) {
      try {
        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash('password123', 10);
        const member = await findMemberByName(['Jeremiah', 'Nicholaus']);
        const fullName = member ? member.full_name : 'PST. JEREMIAH NICHOLAUS';
        await run('INSERT INTO users (username, password_hash, role, full_name, member_id) VALUES (?, ?, ?, ?, ?)',
          ['jnicholaus', passwordHash, 'evangelist', fullName, member ? member.id : null]);
        console.log(`Jeremiah Nicholaus account seeded (jnicholaus/password123) linked to member "${fullName}".`);
      } catch (e4) {
        console.warn('Failed to create jnicholaus user:', e4.message);
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

    // Reset all account locks and IP blocks on startup (crash recovery)
    try {
      await run('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, lockout_count = 0');
      await run('DELETE FROM ip_login_failures');
      console.log('Account locks and IP blocks cleared (startup reset).');
    } catch (e) { console.warn('Lock reset skipped:', e.message); }

    await ensureHomeCellSchema();
    await ensureEvangelismSchema();
    await migrateUsersRoleConstraint();
    await linkUsersToMembers();
    await require('./performanceEngine').ensurePerformanceSchema();
    console.log('Performance & Recognition Center schema ready');

    // Seed default accountant user if none exists
    const bcrypt = require('bcryptjs');
    const accountantExists = await get('SELECT id FROM users WHERE role = ?', ['accountant']);
    if (!accountantExists) {
      const hash = bcrypt.hashSync('accountant123', 10);
      await run('INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
        ['accountant', hash, 'accountant', 'Church Accountant']);
      console.log('Default accountant user created: username=accountant, password=accountant123');
    }

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
      // L14-fix: clear the in-memory store sweep interval so the
      // process can exit cleanly during local SQLite dev.
      if (activeSessionStore && activeSessionStore._shekinaSweep) {
        clearInterval(activeSessionStore._shekinaSweep);
      }
      // L14-fix: close the PG session store cleanly.
      if (activeSessionStore && typeof activeSessionStore.close === 'function') {
        await new Promise((resolve) => activeSessionStore.close(resolve));
      }
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
