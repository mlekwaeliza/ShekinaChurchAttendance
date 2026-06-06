const express = require('express');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { queries, get } = require('../database');
const { isAuthenticated } = require('../middleware/auth');
const { recordSecurityEvent } = require('../utils/securityAudit');

const router = express.Router();

const toSessionUser = (user) => ({
  id: user.id,
  username: user.username,
  role: user.role,
  full_name: user.full_name,
  profile_picture: user.profile_picture,
  is_head: user.is_head,
});

const normalizeBackupCode = (code) => String(code || '').toUpperCase().replace(/\s/g, '');
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }

  let output = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(value) {
  const clean = String(value || '').toUpperCase().replace(/=+$/g, '').replace(/\s/g, '');
  let bits = '';
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function generateTotpUri({ issuer, label, secret }) {
  const issuerValue = encodeURIComponent(issuer);
  const labelValue = `${issuerValue}:${encodeURIComponent(label)}`;
  return `otpauth://totp/${labelValue}?secret=${encodeURIComponent(secret)}&issuer=${issuerValue}&algorithm=SHA1&digits=6&period=30`;
}

function generateTotp(secret, counter) {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;
  return String(code).padStart(6, '0');
}

function verifyTotp({ secret, token, window = 1 }) {
  const cleanToken = String(token || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return false;

  const currentCounter = Math.floor(Date.now() / 30000);
  for (let offset = -window; offset <= window; offset++) {
    const expected = generateTotp(secret, currentCounter + offset);
    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

const hashBackupCode = (code) => crypto
  .createHash('sha256')
  .update(`${process.env.SESSION_SECRET || 'dev-session-secret'}:${normalizeBackupCode(code)}`)
  .digest('hex');

const generateBackupCodes = () => Array.from({ length: 8 }, () =>
  crypto.randomBytes(4).toString('hex').toUpperCase()
);

const storeBackupCodes = (codes) => codes.map((code) => ({ hash: hashBackupCode(code) }));

const backupCodeMatches = (storedCode, normalizedToken) => {
  if (typeof storedCode === 'string') {
    return storedCode === normalizedToken || storedCode === hashBackupCode(normalizedToken);
  }
  return storedCode?.hash === hashBackupCode(normalizedToken);
};

router.post('/verify-login', async (req, res) => {
  try {
    const { token, userId } = req.body;
    if (!token || !userId) return res.status(400).json({ error: 'Token and userId required' });

    const pendingUserId = Number(req.session.pending2FAUserId);
    if (!pendingUserId || pendingUserId !== Number(userId)) {
      return res.status(401).json({ error: 'No pending two-step login found' });
    }

    const user2FA = await queries.getUser2FA(pendingUserId);
    if (!user2FA?.totp_enabled || !user2FA?.totp_secret) {
      return res.status(400).json({ error: 'Two-step verification is not enabled for this account' });
    }

    const normalizedToken = normalizeBackupCode(token);
    let consumedBackupCode = false;
    let remainingCodes = null;

    if (user2FA.backup_codes) {
      try {
        const codes = JSON.parse(user2FA.backup_codes);
        if (Array.isArray(codes) && codes.some((code) => backupCodeMatches(code, normalizedToken))) {
          consumedBackupCode = true;
          remainingCodes = codes.filter((code) => !backupCodeMatches(code, normalizedToken));
        }
      } catch (error) { /* noop */ }
    }

    if (!consumedBackupCode && !verifyTotp({ secret: user2FA.totp_secret, token: normalizedToken })) {
      recordSecurityEvent('2fa_login_failure', pendingUserId, null, req);
      return res.status(400).json({ error: 'Invalid token' });
    }

    const fullUser = await get('SELECT id, username, role, full_name, profile_picture, is_head FROM users WHERE id = ?', [pendingUserId]);
    if (!fullUser) return res.status(404).json({ error: 'User not found' });

    if (consumedBackupCode) {
      await queries.updateUser2FA(pendingUserId, user2FA.totp_secret, true, remainingCodes);
    }

    const sessionUser = toSessionUser(fullUser);

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      req.session.userId = pendingUserId;
      req.session.user = sessionUser;
      req.session.twoFactorVerified = true;
      req.session.totpEnabled = true;
      req.session.createdAt = Date.now();
      delete req.session.pending2FAUserId;
      delete req.session.pending2FAUsername;
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ error: 'Session error' });
        recordSecurityEvent('2fa_login_success', pendingUserId, { usedBackupCode: consumedBackupCode }, req);
        res.json({ message: 'Login successful', user: sessionUser });
      });
    });
  } catch (error) {
    console.error('2FA login verify error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

router.use(isAuthenticated);

router.post('/setup', async (req, res) => {
  try {
    const user = await queries.getUser2FA(req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.totp_enabled) return res.status(400).json({ error: '2FA already enabled' });

    const secret = generateTotpSecret();
    req.session.pendingTotpSecret = secret;
    const otpauth = generateTotpUri({
      issuer: 'Church Attendance System',
      label: req.session.user.username,
      secret,
    });

    const qrCode = await qrcode.toDataURL(otpauth);

    res.json({ secret, otpauth, qrCode });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: 'Failed to generate 2FA setup' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const user = await queries.getUser2FA(req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const setupSecret = req.session.pendingTotpSecret || user.totp_secret;
    if (!setupSecret) return res.status(400).json({ error: 'No 2FA secret found. Complete setup first.' });

    if (!verifyTotp({ secret: setupSecret, token })) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    const backupCodes = generateBackupCodes();

    await queries.updateUser2FA(req.session.userId, setupSecret, true, storeBackupCodes(backupCodes));
    delete req.session.pendingTotpSecret;
    req.session.totpEnabled = true;

    recordSecurityEvent('2fa_enabled', req.session.userId, null, req);
    res.json({ message: '2FA enabled successfully', backupCodes });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

router.post('/disable', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });

    const bcrypt = require('bcryptjs');
    const user = await queries.findUserByUsername(req.session.user.username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // M4-fix: async bcrypt to keep the event loop responsive.
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid password' });

    await queries.disableUser2FA(req.session.userId);
    req.session.twoFactorVerified = false;
    req.session.totpEnabled = false;

    recordSecurityEvent('2fa_disabled', req.session.userId, null, req);
    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const user2FA = await queries.getUser2FA(req.session.userId);
    res.json({
      enabled: Boolean(user2FA?.totp_enabled),
      hasSecret: Boolean(user2FA?.totp_secret),
      backupCodesRemaining: user2FA?.backup_codes ? JSON.parse(user2FA.backup_codes).length : 0
    });
  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
});

router.post('/regenerate-backup-codes', async (req, res) => {
  try {
    const user2FA = await queries.getUser2FA(req.session.userId);
    if (!user2FA?.totp_enabled) return res.status(400).json({ error: '2FA not enabled' });

    const newCodes = generateBackupCodes();

    await queries.updateUser2FA(req.session.userId, user2FA.totp_secret, true, storeBackupCodes(newCodes));
    res.json({ backupCodes: newCodes });
  } catch (error) {
    console.error('Regenerate backup codes error:', error);
    res.status(500).json({ error: 'Failed to regenerate backup codes' });
  }
});

module.exports = router;
