const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { recordSecurityEvent } = require('../utils/securityAudit');
const { queries } = require('../database');

const router = express.Router();

const IP_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const IP_LOGIN_MAX = 25;
async function checkIpLoginBlocked(ip) {
  const state = await queries.getIpLoginState(ip);
  if (!state) return false;
  if (state.lockedUntil && Date.now() < new Date(state.lockedUntil).getTime()) return true;
  return false;
}
async function recordIpLoginFailure(ip) {
  await queries.recordIpLoginFailure(ip);
}
async function resetIpLoginState(ip) {
  await queries.resetIpLoginState(ip);
}
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/profiles/'))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('Invalid file type. Only JPG, PNG, GIF, and WebP images are allowed.'));
    }
    cb(null, req.session.userId + '-' + uniqueSuffix + ext)
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    let { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    if (await checkIpLoginBlocked(ip)) {
      return res.status(423).json({ error: 'Too many failed attempts from this network. Try again in 15 minutes.' });
    }

    username = username.trim();
    password = password.trim();

    const user = await queries.findUserByUsername(username);
    if (!user) {
      // Constant-time-ish dummy compare to reduce user enumeration timing.
      // M4-fix: async to avoid blocking the event loop.
      await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
      await recordIpLoginFailure(ip);
      // I5-fix: audit unknown-username attempts (with the attempted
      // username in details — operator-grade, not user-facing).
      recordSecurityEvent('login_failure', null, { username, reason: 'unknown_user' }, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.locked_until) {
      const lockExpiry = new Date(user.locked_until);
      if (new Date() < lockExpiry) {
        const minutesLeft = Math.ceil((lockExpiry - new Date()) / 60000);
        recordSecurityEvent('login_blocked', user.id, { reason: 'account_locked', minutesLeft }, req);
        return res.status(423).json({ error: `Account locked. Try again in ${minutesLeft} minutes.` });
      } else {
        await queries.resetFailedLogin(user.id);
      }
    }

    // M4-fix: async bcrypt to keep the event loop responsive.
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      await queries.incrementFailedLogin(user.id);
      await recordIpLoginFailure(ip);

      if (attempts >= 10) {
        const lockoutCount = (user.lockout_count || 0) + 1;
        // Exponential backoff: 30min, 1hr, 2hr, 4hr, 8hr (max)
        const lockoutMinutes = [30, 60, 120, 240, 480];
        const minutes = lockoutMinutes[Math.min(lockoutCount - 1, lockoutMinutes.length - 1)];
        const lockUntil = new Date(Date.now() + minutes * 60 * 1000);
        await queries.lockUser(user.id, lockUntil.toISOString());
        recordSecurityEvent('account_locked', user.id, { attempts, lockoutCount, lockUntil: lockUntil.toISOString() }, req);
        return res.status(423).json({ error: `Account locked due to too many failed attempts. Try again in ${minutes} minutes.` });
      }

      recordSecurityEvent('login_failure', user.id, { username, attempts, reason: 'bad_password' }, req);
      return res.status(401).json({ error: `Invalid credentials. ${10 - attempts} attempts remaining.` });
    }

    await queries.resetFailedLogin(user.id);
    await resetIpLoginState(ip);

    // Check if 2FA is enabled
    if (user.totp_enabled) {
      const finishPending2FA = () => {
        req.session.pending2FAUserId = user.id;
        req.session.pending2FAUsername = user.username;
        req.session.twoFactorVerified = false;
        req.session.totpEnabled = true;
        recordSecurityEvent('login_success_partial', user.id, { reason: '2fa_required' }, req);
        res.json({ message: '2FA required', requires2FA: true, userId: user.id });
      };
      return req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: 'Session error' });
        finishPending2FA();
      });
    }

    const sessionUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      profile_picture: user.profile_picture,
      is_head: user.is_head,
      is_new_member_leader: user.is_new_member_leader
    };

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      req.session.userId = user.id;
      req.session.user = sessionUser;
      req.session.twoFactorVerified = true;
      req.session.totpEnabled = !!user.totp_enabled;
      req.session.createdAt = Date.now();
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ error: 'Session error' });
        recordSecurityEvent('login_success', user.id, { role: user.role }, req);
        res.json({ message: 'Login successful', user: sessionUser });
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  const userId = req.session?.userId || null;
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    recordSecurityEvent('logout', userId, null, req);
    res.clearCookie('sc.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// Check session
router.get('/me', async (req, res) => {
  if (req.session.user) {
    if (req.session.twoFactorVerified) {
      try {
        const user = await queries.findUserByUsername(req.session.user.username);
        if (user) {
          req.session.user.profile_picture = user.profile_picture;
          req.session.user.full_name = user.full_name;
          req.session.user.is_head = user.is_head;
          req.session.user.is_new_member_leader = user.is_new_member_leader;
        }
        res.json({ user: req.session.user });
      } catch (e) {
        res.json({ user: req.session.user });
      }
    } else {
      const user2FA = await queries.getUser2FA(req.session.userId);
      if (user2FA?.totp_enabled) {
        return res.json({ requires2FA: true, userId: req.session.userId });
      }
      res.json({ user: req.session.user });
    }
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Change password
router.post('/change-password', async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password required' });
    }

    if (new_password.length < 8) {
      // M5-fix: enforce min length 8 (was 6) to align with the
      // 12-char minimum for the bootstrapped admin password.
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Get user from session
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Use session user ID to get user directly
    const user = await get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // M4-fix: async bcrypt to keep the event loop responsive.
    const validPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // M4-fix: async bcrypt.
    const newPasswordHash = await bcrypt.hash(new_password, 10);
    await queries.updateUserPassword(newPasswordHash, user.id);

    // M9-fix: regenerate the session on password change to prevent
    // session-fixation attacks where a hijacked pre-change session
    // cookie is still considered authenticated.
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    req.session.userId = user.id;
    req.session.user = { id: user.id, username: user.username, role: user.role, full_name: user.full_name, is_new_member_leader: user.is_new_member_leader };
    req.session.createdAt = Date.now();
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    recordSecurityEvent('password_changed', user.id, null, req);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Update profile details
router.put('/profile', async (req, res) => {
  try {
    const { full_name, member_id } = req.body;
    if (!full_name || full_name.trim().length === 0) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await queries.updateUserFullName(full_name.trim(), req.session.userId, member_id || null);
    req.session.user.full_name = full_name.trim();
    if (member_id) req.session.user.member_id = member_id;
    res.json({ message: 'Profile updated', full_name: full_name.trim() });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload profile picture
router.post('/profile-picture', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  upload.single('image')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    try {
      // Create the URL path to save in DB
      const pictureUrl = `/uploads/profiles/${req.file.filename}`;
      
      // Update database
      await queries.updateUserProfilePicture(pictureUrl, req.session.userId);
      
      // Update session
      req.session.user.profile_picture = pictureUrl;
      
      res.json({ 
        message: 'Profile picture updated successfully',
        profile_picture: pictureUrl
      });
    } catch (error) {
      console.error('Profile picture update error:', error);
      res.status(500).json({ error: 'Failed to update profile picture' });
    }
  });
});

module.exports = router;
