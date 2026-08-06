// Length caps for traveler/request (parcel) post fields, shared by the API
// (which enforces them) and the composer (which mirrors them as maxLength).
// Change one number here rather than two literals in api/posts.ts and
// PostFormModal.tsx.

export const PARCEL_CITY_MAX = 100;
export const PARCEL_CATEGORY_OTHER_MAX = 100;
export const PARCEL_NOTE_MAX = 1000;
