import { FLEXIBLE_DATE } from './date';

export type DateFormatVariant = 'short' | 'long';

// "3 Avgust" (short) or "3-Avgust, 2026" (long). Both call sites source their
// month names from the Translations table, so no Uzbek is spelled out here.
function formatDateParts(d: Date, variant: DateFormatVariant, months: string[]): string {
  return variant === 'long'
    ? `${d.getDate()}-${months[d.getMonth()]}, ${d.getFullYear()}`
    : `${d.getDate()} ${months[d.getMonth()]}`;
}

// Formats a traveler/request post's travel date. Null and FLEXIBLE_DATE both
// mean "no fixed date" (the latter is the older wire form — see lib/date.ts)
// and render as "Kelishiladi". A date that doesn't parse falls back to the
// raw string rather than being silently dropped.
export function formatFlexibleDate(
  dateStr: string | null,
  variant: DateFormatVariant,
  months: string[],
): string {
  if (!dateStr || dateStr === FLEXIBLE_DATE) {
    return 'Kelishiladi';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return formatDateParts(d, variant, months);
}

// Formats an announcement's created_at timestamp — always present, never the
// flexible sentinel. Falls back to "" if it somehow doesn't parse.
export function formatPostedDate(createdAt: string, months: string[]): string {
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return '';
  return formatDateParts(d, 'short', months);
}
