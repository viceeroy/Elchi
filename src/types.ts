// Common TypeScript interfaces and types for Elchi

// "announcement" is a standing ad — a cargo service, an agency — rather than
// one trip. It carries a headline, a body, a route and a contact, and none of
// the cities/date/cargo fields the parcel types use.
export type PostType = "traveler" | "request" | "announcement";

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
  // Which corridor an announcement is listed under — the far country of the
  // corridor its author was browsing. Distinct from from_country (where the
  // service sits), because every corridor has Uzbekistan on the near side and
  // a note sitting there would otherwise belong to all of them. Null on parcel
  // posts, whose corridor is their route.
  corridor_country: string | null;
  // Free-text cities — display only, never used for filtering. Null on
  // announcements, which apply to a corridor rather than a city pair.
  from_city: string | null;
  to_city: string | null;
  // YYYY-MM-DD, or null when there is no fixed date: an announcement, or a
  // request whose date is negotiated directly with the traveler.
  date: string | null;
  // Structured cargo data — the source of truth for filtering and display logic.
  weight_kg: number;
  luggage_count: number;
  categories: string[];
  category_other: string | null;
  // Pre-rendered display string built from the fields above, e.g.
  // "5 kg + 2 chamadon" or "3 kg · Hujjatlar, Dori-darmon". Empty on
  // announcements, which carry no cargo.
  weight: string;
  // Announcement headline; null on parcel posts.
  headline: string | null;
  // The free-text body of the ad: an optional remark on a parcel post, the
  // required body copy on an announcement.
  note: string | null;
  // Contact VALUES are deliberately absent from this shape. The feed reads the
  // `public_posts` view, which omits them, so a scraper cannot pull every
  // author's phone number in one request. The channel of each contact is still
  // exposed so the UI can render the right icon before the viewer logs in;
  // the handles themselves come from fetchPostContact() — see PostContact.
  contact_type: ContactMethod | null;
  contact2_type: ContactMethod | null;
  has_contact2: boolean;
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

  // Composer speed dial — the floating "+" and the three things it opens: the
  // two sides of a parcel ad, and a note.
  fabOpenLabel?: string;
  fabCloseLabel?: string;
  fabTravelerLabel?: string;
  fabRequestLabel?: string;
  fabNoteLabel?: string;

  // Feed tab switcher — Pochta (parcel posts) vs E'lonlar (board notes /
  // announcements). Exclusive: only one of the two shows at a time.
  feedTabParcelLabel?: string;
  feedTabNotesLabel?: string;
  // Sticker label on an announcement card, alongside travelerTag/requestTag.
  announcementTag?: string;

  // Announcement stub — the navy panel on the right of the card. A note has no
  // travel date, so where a parcel card shows the trip its stub shows the date
  // the ad went up.
  stubPostedLabel: string;

  // Month names, January first. The single source for every date the board
  // renders: the two card stubs and the detail sheet all read this array, which
  // is why it is NOT optional — an absent key would have to be covered by an
  // Uzbek literal inside a component, and there used to be three such copies.
  months: string[];

  // Body label on an announcement in the detail sheet.
  announcementBodyLabel?: string;

  // Note sheet ("E'lon" / "Заметка" / "Note") — one free-text field and a
  // contact, and none of the parcel fields.
  noteTitle?: string;
  noteSubtitle?: string;
  noteThemeLabel?: string;
  noteThemePlaceholder?: string;
  noteTextLabel?: string;
  noteTextPlaceholder?: string;
  // Contact is optional on a note, so its label differs from the parcel form's.
  noteContactLabel?: string;
  noteSubmitBtn?: string;
  noteAutoDeleteLabel?: string;
  errorFieldNoteText?: string;
  toastNoteCreated?: string;
}
