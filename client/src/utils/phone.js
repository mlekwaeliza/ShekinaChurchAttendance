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
 * Instantly converts a leading 0 to +255 as the user types.
 */
export function handlePhoneChange(value) {
  if (!value) return '';

  // If the field contains only the placeholder prefix, treat as empty so it
  // can be cleared with backspace and doesn't trigger "Invalid phone format"
  // on save (server also normalizes, but clearing UX matters).
  const trimmed = String(value).trim();
  if (trimmed === '+255' || trimmed === '+255 ' || trimmed === '255' || trimmed === '0') {
    // If the user is deleting, let them clear to empty; keep prefix display
    // only when they just typed "0"
    if (trimmed === '0') return '+255 ';
    // For other prefix-only values, don't force "+255 " — allow empty
    // (handlePhoneChange is called on every keystroke, so returning '' lets
    // backspace clear the field)
    const rawForCheck = String(value).replace(/[^0-9+]/g, '');
    if (rawForCheck === '0') return '+255 ';
    // If the input is exactly the prefix, keep it as prefix for UX until
    // they type more, but don't lock them in
    if (trimmed === '+255' || trimmed === '255') return '+255 ';
  }

  // Strip everything except digits and leading +
  const raw = String(value).replace(/[^0-9+]/g, '');

  // As soon as user types a single "0", immediately swap to "+255 "
  if (raw === '0') return '+255 ';

  // If they type "07...", "08...", etc. — convert on the fly
  if (raw.startsWith('0') && raw.length > 1) {
    const rest = raw.slice(1); // digits after the leading 0
    return '+255 ' + formatDigits(rest);
  }

  // For everything else, use the full formatter (handles +255, 255, paste, etc.)
  return formatPhone(value);
}

/**
 * Sanitize phone for submit — converts placeholder-only values ("255", "+255", "+255 ", "0")
 * and whitespace-only to empty string so server validation passes for members without phones.
 * Keep in sync with server's normalizePhone().
 */
export function sanitizePhone(value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (s === '') return '';
  if (s === '255' || s === '+255' || s === '0') return '';
  const digits = s.replace(/\D/g, '');
  if (digits === '255' && /^\+?\s*255\s*$/.test(s)) return '';
  if (digits === '0' && /^0\s*$/.test(s)) return '';
  // "+255 " after trim is "+255" -> already handled
  return s;
}

/**
 * Convert name to ALL CAPS.
 * Works on both typing and pasting.
 */
export function capitalizeName(value) {
  if (!value) return '';
  return value.toUpperCase();
}

/**
 * onPaste handler for name fields — auto-capitalizes after paste.
 */
export function handleNamePaste(e, setter, fieldName) {
  e.preventDefault();
  const pasted = (e.clipboardData || window.clipboardData).getData('text');
  const capitalized = capitalizeName(pasted);
  setter(prev => ({ ...prev, [fieldName]: capitalized }));
}

