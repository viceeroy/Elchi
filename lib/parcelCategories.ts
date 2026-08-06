// Parcel category ids, shared by the API (which enforces them) and the
// composer (which maps each id to its Uzbek chip label locally — only the
// ids need to travel across the boundary). Change the chip list here rather
// than syncing api/posts.ts's allow-list against it by hand.

export const PARCEL_CATEGORY_IDS = [
  'docs',
  'clothes',
  'meds',
  'food',
  'phone',
  'gift',
] as const;
