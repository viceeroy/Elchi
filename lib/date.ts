// Sentinel written into a traveler/request post's `date` field when the
// author has no fixed date and leaves it to be negotiated. Newer rows store
// NULL instead (see api/posts.ts); this string is kept only because older
// rows still have it on disk.
export const FLEXIBLE_DATE = 'flexible';
