// The display name a profile carries, and the one place its shape is defined.
//
// Captured once, right after login, by the blocking gate in src/App.tsx. There
// is no edit UI, so this is the only writer on the client side — but it is NOT
// the security boundary: the name is written straight to `profiles` through
// PostgREST under the own-row UPDATE policy, so the real enforcement is the
// `profiles_display_name_check` CHECK in supabase-schema.sql. Change one and
// change the other, the same way lib/contact.ts is duplicated on purpose.

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;

/**
 * What actually gets stored: outer whitespace gone, inner runs collapsed to a
 * single space. Typing "Bobur   K." and "Bobur K." must not produce two
 * different names on two different cards.
 */
export function normalizeDisplayName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function isValidDisplayName(raw: string): boolean {
  const value = normalizeDisplayName(raw);
  return value.length >= DISPLAY_NAME_MIN && value.length <= DISPLAY_NAME_MAX;
}
