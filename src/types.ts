// Common TypeScript interfaces and types for Elchi

// The two sides of the same trade: someone flying with spare luggage space, and
// someone with a parcel that needs carrying. A third arm, "announcement" (a
// standing service ad), was removed on 2026-08-07 — see
// migrations/2026-08-07-remove-announcements.sql.
export type PostType = "traveler" | "request";

export type Direction = "k2u" | "u2k";

export type ContactMethod = "telegram" | "phone";

export interface Post {
  id: string;
  type: PostType;
  direction: Direction | null; // legacy KR↔UZ pair; null on other routes
  // ISO 3166-1 alpha-2 route countries — the structured, filterable data.
  // Nullable only for rows created before the countries migration.
  from_country: string | null;
  to_country: string | null;
  // Free-text cities — display only, never used for filtering. Nullable at the
  // column level only: posts_shape_by_type_check requires both.
  from_city: string | null;
  to_city: string | null;
  // YYYY-MM-DD, or null when there is no fixed date — a request whose date is
  // negotiated directly with the traveler.
  date: string | null;
  // Structured cargo data — the source of truth for filtering and display logic.
  weight_kg: number;
  luggage_count: number;
  categories: string[];
  category_other: string | null;
  // Pre-rendered display string built from the fields above, e.g.
  // "5 kg + 2 chamadon" or "3 kg · Hujjatlar, Dori-darmon".
  weight: string;
  // `headline` is deliberately absent. The column still exists — it holds the
  // retired announcements' themes — but it is NULL on every post the board can
  // read, so the API stops selecting it (PUBLIC_COLUMNS in api/posts.ts) rather
  // than shipping a field that is always null.
  //
  // The free-text body of the ad: an optional remark on the trip.
  note: string | null;
  // Contact VALUES are deliberately absent from this shape. The feed reads the
  // `public_posts` view, which omits them, so a scraper cannot pull every
  // author's phone number in one request. The channel of each contact is still
  // exposed so the UI can render the right icon before the viewer logs in;
  // the handles themselves come from fetchPostContact() — see PostContact.
  contact_type: ContactMethod | null;
  contact2_type: ContactMethod | null;
  has_contact2: boolean;
  // The author's chosen name, joined into `public_posts` from `profiles`.
  // Nullable: rows written before the capture gate belong to profiles that have
  // no name yet, and posts predating user_id have no profile at all. Cards fall
  // back to AUTHOR_FALLBACK (src/lib/authorName.ts).
  display_name: string | null;
  created_at: string;
  expires_at: string;
  // Set by the API from the caller's bearer token. user_id itself is never
  // sent to the client, so posts can't be correlated back to an author.
  is_mine?: boolean;
}

// Contact handles for a single post, fetched on demand and only for logged-in
// viewers (GET /api/posts?id=...&fields=contact).
export interface PostContact {
  contact: string;
  contact_type: ContactMethod | null;
  contact2: string | null;
  contact2_type: ContactMethod | null;
}

// The board serves an Uzbek-speaking audience only. The type stays a named
// union of one rather than disappearing, because the translations table and the
// country registry are still keyed by it — a second locale is a matter of
// adding the arm back and filling in the tables.
export type Locale = "uz";

export interface Translations {
  metaTitle: string;
  metaDescription: string;
  tagline: string;
  title: string;
  titleAccent: string;
  activeCount: string;
  korea: string;
  uzbekistan: string;
  travelerTag: string;
  requestTag: string;
  contactBtn: string;
  activeAds: string;
  postAdBtn: string;
  disclaimerTitle: string;
  disclaimerText: string;
  
  // Form Sheet
  addPostTitle: string;
  addPostSubTraveler: string;
  addPostSubRequest: string;
  stepAdType: string;
  stepRoute: string;
  stepCities: string;
  stepDate: string;
  stepCargo: string;
  stepContact: string;
  btnNext: string;
  btnBack: string;
  subtravelerDesc: string;
  subrequestDesc: string;
  tabTraveler: string;
  tabRequest: string;
  fromToLabel: string;
  fromPlaceholder: string;
  toPlaceholder: string;
  dateLabelTraveler: string;
  dateLabelRequest: string;
  selectDatePlaceholder: string;
  dateFlexibleBtn: string;
  weightLabelTraveler: string;
  weightLabelRequest: string;
  weightUnitKg: string;
  luggageLabel: string;
  addLuggageBtn: string;
  itemTypeOtherPlaceholder: string;
  noteLabel: string;
  notePlaceholder: string;
  contactLabel: string;
  contactPlaceholder: string;
  addTelegramBtn?: string;
  addPhoneBtn?: string;
  secondaryContactLabel?: string;
  submitBtn: string;
  submittingBtn: string;
  successTitle: string;
  errorRequiredFields: string;
  errorGeneral: string;
  // Per-field validation messages, shown inline beneath the offending field
  errorFieldFromCity?: string;
  errorFieldToCity?: string;
  errorFieldDate?: string;
  errorFieldWeight?: string;
  errorFieldCategory?: string;
  errorFieldNote?: string;
  errorFieldContact?: string;
  errorContactTelegram: string;
  errorContactPhone: string;
  autoDeleteLabel: string;
  deleteBtn?: string;
  deleteConfirm?: string;
  shareBtn?: string;
  shareTitle?: string;
  shareSuccess?: string;
  contactHelpTitle?: string;
  contactHelpText?: string;
  contactHelpCopyText?: string;
  contactHelpCopied?: string;
  toastPostCreated: string;
  loadMoreBtn?: string;
  allLoaded?: string;
  emptyStateTitle?: string;
  emptyStateText?: string;
  stubLabel?: string;

  // Login modal
  loginTitle?: string;
  loginSubtitle?: string;
  continueWithTelegram?: string;
  continueWithGoogle?: string;
  continueWithEmail?: string;
  emailPlaceholder?: string;
  orDivider?: string;
  checkYourEmailTitle?: string;
  checkYourEmailText?: string;
  codePlaceholder?: string;
  verifyBtn?: string;
  verifyingBtn?: string;
  useAnotherEmail?: string;
  loginErrorGeneral?: string;
  loginErrorInvalidCode?: string;
  signedInAs?: string;
  signOut?: string;
  profileMenuLabel?: string;
  profileTitle?: string;
  profilePostsCount?: string;
  profileLoginMethod?: string;
  methodTelegram?: string;
  methodGoogle?: string;
  contactLockedText: string;
  contactLockedBtn: string;

  // Name gate — the blocking step after a login that lands on a profile with no
  // display_name. Not optional in spirit: the sheet cannot be dismissed, so a
  // missing string here would leave a user staring at an unlabelled dialog.
  nameGateTitle?: string;
  nameGateSubtitle?: string;
  nameGateLabel?: string;
  nameGatePlaceholder?: string;
  nameGateSubmit?: string;
  nameGateSaving?: string;
  nameGateErrorInvalid?: string;

  // Screen-reader-only announcements. These are never painted — they exist so
  // that a state change with no visual equivalent in the accessibility tree
  // (a handle arriving, a value copied, a post deleted) is spoken. Keep them
  // short: they are read aloud in full, interrupting nothing else.
  srContactRevealed?: string;
  srCopied?: string;
  srPostDeleted?: string;

  // Accessible names for controls that render as an icon alone. A sighted user
  // reads the ✕ glyph; a screen reader has nothing to read without these, and
  // every sheet in the app closes through one of them.
  closeLabel?: string;
  dismissLabel?: string;
  copyContactLabel?: string;
  // The post detail sheet has no heading element to point `aria-labelledby` at
  // — its title is the route line, which is a different shape per post type —
  // so the dialog carries a static name instead.
  postDetailsTitle?: string;

  // Composer speed dial — the floating "+" and the two things it opens: the
  // two sides of a parcel ad.
  fabOpenLabel?: string;
  fabCloseLabel?: string;
  fabTravelerLabel?: string;
  fabRequestLabel?: string;

  // Month names, January first. The single source for every date the board
  // renders: the two card stubs and the detail sheet all read this array, which
  // is why it is NOT optional — an absent key would have to be covered by an
  // Uzbek literal inside a component, and there used to be three such copies.
  months: string[];
}
