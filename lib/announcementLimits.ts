// Length caps for an announcement (standing-ad) post, shared by the API
// (which enforces them) and the composer (which mirrors them as maxLength /
// a live counter). Change one number here rather than two literals in
// api/posts.ts and NoteFormModal.tsx.

export const ANNOUNCEMENT_HEADLINE_MAX = 80;
export const ANNOUNCEMENT_NOTE_MAX = 500;
