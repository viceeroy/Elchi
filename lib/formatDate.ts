// Sentinel written into a traveler/request post's `date` field when the
// author has no fixed date and leaves it to be negotiated. Newer rows store
// NULL instead (see api/posts.ts); this string is kept only because older
// rows still have it on disk.
export const FLEXIBLE_DATE = 'flexible';

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
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return dateStr;
  return formatDateParts(d, variant, months);
}
