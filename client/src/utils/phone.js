/**
 * Format a phone number as +255 XXX XXX XXX
 * Handles: 0XXXXXXXXX, 255XXXXXXXXX, +255XXXXXXXXX, and partial input
 */
export function formatPhone(value) {
  if (!value) return '';
  const raw = String(value).replace(/[^0-9+]/g, '');

  if (raw.startsWith('+255')) {
    const digits = raw.slice(4).replace(/\D/g, '');
    return '+255 ' + formatDigits(digits);
  }
  if (raw.startsWith('255') && !raw.startsWith('2550')) {
    const digits = raw.slice(3).replace(/\D/g, '');
    return '+255 ' + formatDigits(digits);
  }
  if (raw.startsWith('0')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    return '+255 ' + formatDigits(digits);
  }
  if (/^\d/.test(raw)) {
    return '+255 ' + formatDigits(raw.replace(/\D/g, ''));
  }
  return value;
}

function formatDigits(digits) {
  const d = digits.slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + ' ' + d.slice(3);
  return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
}

/**
 * Handle phone input change — returns the formatted value to set in state.
 */
export function handlePhoneChange(value) {
  return formatPhone(value);
}

/**
 * Auto-capitalize first letter of each word (title case for names).
 */
export function capitalizeName(value) {
  if (!value) return '';
  return value.replace(/\b\w/g, c => c.toUpperCase());
}

