// Common TypeScript interfaces and types for Elchi

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
  // Free-text cities — display only, never used for filtering
  from_city: string;
  to_city: string;
  date: string; // YYYY-MM-DD
  // Structured cargo data — the source of truth for filtering and display logic.
  weight_kg: number;
  luggage_count: number;
  categories: string[];
  category_other: string | null;
  // Pre-rendered display string built from the fields above, e.g.
  // "5 kg + 2 chamadon" or "3 kg · Hujjatlar, Dori-darmon".
  weight: string;
  note: string | null;
  contact: string;
  contact_type: ContactMethod | null;
  contact2: string | null;
  contact2_type: ContactMethod | null;
  created_at: string;
  expires_at: string;
  user_id?: string | null;
}

export type Locale = "uz" | "ru" | "en";

export interface Translations {
  tagline: string;
  title: string;
  titleAccent: string;
  activeCount: string;
  allPosts: string;
  koreaToUzbekistan: string;
  uzbekistanToKorea: string;
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
}
