const crypto = require('crypto');

function validatePasswordPolicy(password) {
  const value = String(password || '');
  const failures = [];

  if (value.length < 12) failures.push('at least 12 characters');
  if (!/[a-z]/.test(value)) failures.push('one lowercase letter');
  if (!/[A-Z]/.test(value)) failures.push('one uppercase letter');
  if (!/\d/.test(value)) failures.push('one number');
  if (!/[^A-Za-z0-9]/.test(value)) failures.push('one symbol');
  if (/\s/.test(value)) failures.push('no spaces');

  return {
    valid: failures.length === 0,
    message: failures.length
      ? `Password must contain ${failures.join(', ')}.`
      : null
  };
}

function generateTemporaryPassword(prefix = 'Temp') {
  const safePrefix = String(prefix || 'Temp').replace(/[^A-Za-z]/g, '').slice(0, 8) || 'Temp';
  return `${safePrefix}!${crypto.randomInt(10, 99)}${crypto.randomBytes(8).toString('base64url')}`;
}

module.exports = { generateTemporaryPassword, validatePasswordPolicy };
