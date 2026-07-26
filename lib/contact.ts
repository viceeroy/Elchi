// Contact handle rules, shared by the API (which enforces them) and the client
// (which mirrors them for inline feedback and for building tel:/t.me links).
// The API is the security boundary — the client copy exists so a user sees the
// problem before a round trip, never as a substitute for the server check.
//
// Both channels are validated against the declared contact_type rather than by
// sniffing a leading "@", so the stored type and the stored value can't
// disagree.

// Telegram usernames: 5–32 characters, letters/digits/underscore, first
// character a letter. Stored with the leading "@" the form adds.
const TELEGRAM_RE = /^@[A-Za-z][A-Za-z0-9_]{4,31}$/;

// Phones are stored in the shape the author typed — the form's own sanitizer
// permits digits, "+", spaces, hyphens and parentheses, and the placeholder
// ("+998 90-123-4567") actively encourages the separators. So the pattern
// allows that punctuation and the digit COUNT carries the real constraint:
// 7–15, the E.164 range. A "+" is only meaningful leading, so it isn't
// permitted anywhere else.
const PHONE_RE = /^\+?[\d\s()-]+$/;
const PHONE_MIN_DIGITS = 7;
const PHONE_MAX_DIGITS = 15;

export type ContactKind = 'telegram' | 'phone';

export function isContactKind(v: unknown): v is ContactKind {
  return v === 'telegram' || v === 'phone';
}

function digitCount(value: string): number {
  return (value.match(/\d/g) || []).length;
}

export function isValidContact(value: string, kind: ContactKind): boolean {
  const trimmed = value.trim();
  if (kind === 'telegram') return TELEGRAM_RE.test(trimmed);
  if (!PHONE_RE.test(trimmed)) return false;
  const digits = digitCount(trimmed);
  return digits >= PHONE_MIN_DIGITS && digits <= PHONE_MAX_DIGITS;
}

// The username for a t.me link. Strips the "@" and anything outside the
// username charset, so a legacy row that predates validation still can't steer
// the URL somewhere unintended.
export function telegramUsername(handle: string): string {
  return handle.trim().replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
}

// The dial string for a tel: link. Spaces and separators are fine to display
// but don't belong in the URI, and a "+" is only valid leading.
export function phoneDialString(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}
