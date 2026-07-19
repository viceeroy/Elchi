// Common TypeScript interfaces and types for Elchi

export type PostType = "traveler" | "request";

export interface Post {
  id: string;
  type: PostType;
  from_city: string;
  to_city: string;
  date: string; // YYYY-MM-DD
  weight: string;
  price: string | null;
  note: string | null;
  contact: string;
  created_at: string;
  expires_at: string;
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
  travelerTag: string;
  requestTag: string;
  contactBtn: string;
  activeAds: string;
  postAdBtn: string;
  disclaimerTitle: string;
  disclaimerText: string;
  reportBtn: string;
  reportedToast: string;
  
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
  priceLabel: string;
  pricePlaceholder: string;
  contactLabel: string;
  contactPlaceholder: string;
  submitBtn: string;
  submittingBtn: string;
  successTitle: string;
  errorRequiredFields: string;
  errorGeneral: string;
  autoDeleteLabel: string;
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
  stubLabel: string;
  directionK2U: string;
  directionU2K: string;
}
