const { generateTemporaryPassword, validatePasswordPolicy } = require('../utils/passwordPolicy');

describe('password policy', () => {
  test('accepts a production-strength password', () => {
    expect(validatePasswordPolicy('Shekina!2026A').valid).toBe(true);
  });

  test('rejects short or incomplete passwords', () => {
    const result = validatePasswordPolicy('short1!');

    expect(result.valid).toBe(false);
    expect(result.message).toContain('at least 12 characters');
    expect(result.message).toContain('one uppercase letter');
  });

  test('rejects passwords containing spaces', () => {
    const result = validatePasswordPolicy('Strong Pass!2026');

    expect(result.valid).toBe(false);
    expect(result.message).toContain('no spaces');
  });

  test('generates temporary passwords that satisfy policy', () => {
    const password = generateTemporaryPassword('Leader');

    expect(validatePasswordPolicy(password).valid).toBe(true);
  });
});
