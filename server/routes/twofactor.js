const express = require('express');
const { generateSecret, generateSync, verifySync, generateURI } = require('otplib');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { queries, get } = require('../database');
const { isAuthenticated } = require('../middleware/auth');

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
    if (user2FA.backup_codes) {
      try {
        const codes = JSON.parse(user2FA.backup_codes);
        if (Array.isArray(codes) && codes.some((code) => backupCodeMatches(code, normalizedToken))) {
          const remaining = codes.filter((code) => !backupCodeMatches(code, normalizedToken));
          await queries.updateUser2FA(pendingUserId, user2FA.totp_secret, true, remaining);
          const fullUser = await get('SELECT id, username, role, full_name, profile_picture, is_head FROM users WHERE id = ?', [pendingUserId]);
          if (!fullUser) return res.status(404).json({ error: 'User not found' });
          req.session.userId = pendingUserId;
          req.session.user = toSessionUser(fullUser);
          req.session.twoFactorVerified = true;
          delete req.session.pending2FAUserId;
          delete req.session.pending2FAUsername;
          return res.json({ message: 'Login successful', user: req.session.user });
        }
      } catch (error) {}
    }

    const result = verifySync({ secret: user2FA.totp_secret, token: normalizedToken });
    if (!result.valid) return res.status(400).json({ error: 'Invalid token' });

    const fullUser = await get('SELECT id, username, role, full_name, profile_picture, is_head FROM users WHERE id = ?', [pendingUserId]);
    if (!fullUser) return res.status(404).json({ error: 'User not found' });
    req.session.userId = pendingUserId;
    req.session.user = toSessionUser(fullUser);
    req.session.twoFactorVerified = true;
    delete req.session.pending2FAUserId;
    delete req.session.pending2FAUsername;
    res.json({ message: 'Login successful', user: req.session.user });
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

    const secret = generateSecret();
    req.session.pendingTotpSecret = secret;
    const otpauth = generateURI({
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

    const result = verifySync({ secret: setupSecret, token });
    if (!result.valid) return res.status(400).json({ error: 'Invalid token' });

    const backupCodes = generateBackupCodes();

    await queries.updateUser2FA(req.session.userId, setupSecret, true, storeBackupCodes(backupCodes));
    delete req.session.pendingTotpSecret;

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

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid password' });

    await queries.disableUser2FA(req.session.userId);
    req.session.twoFactorVerified = false;

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
