// Country registry — the source of truth for which countries the board supports.
// Cities are free text typed by the user; only the country is structured data.
// To support a new country (e.g. Kazakhstan), add an entry here AND to
// ALLOWED_COUNTRIES in api/posts.ts — posts, filtering, and the route selector
// all key off the ISO code.
export interface Country {
  code: string; // ISO 3166-1 alpha-2, stored on posts (from_country / to_country)
  airport: string; // IATA code of the main hub airport, shown big in the route card
  names: { uz: string; ru: string; en: string };
  cityNames: { uz: string; ru: string; en: string }; // hub city, shown in dropdowns
}

export const COUNTRIES: Country[] = [
  {
    code: "KR",
    airport: "ICN",
    names: { uz: "Koreya", ru: "Корея", en: "Korea" },
    cityNames: { uz: "Incheon", ru: "Инчхон", en: "Incheon" },
  },
  {
    code: "UZ",
    airport: "TAS",
    names: { uz: "O'zbekiston", ru: "Узбекистан", en: "Uzbekistan" },
    cityNames: { uz: "Toshkent", ru: "Ташкент", en: "Tashkent" },
  },
  // To launch more corridors, uncomment (and mirror in ALLOWED_COUNTRIES in
  // api/posts.ts). Verified working 2026-07-23.
  // {
  //   code: "KZ",
  //   airport: "ALA",
  //   names: { uz: "Qozog'iston", ru: "Казахстан", en: "Kazakhstan" },
  //   cityNames: { uz: "Almati", ru: "Алматы", en: "Almaty" },
  // },
  // {
  //   code: "TJ",
  //   airport: "DYU",
  //   names: { uz: "Tojikiston", ru: "Таджикистан", en: "Tajikistan" },
  //   cityNames: { uz: "Dushanbe", ru: "Душанбе", en: "Dushanbe" },
  // },
  // {
  //   code: "KG",
  //   airport: "FRU",
  //   names: { uz: "Qirg'iziston", ru: "Кыргызстан", en: "Kyrgyzstan" },
  //   cityNames: { uz: "Bishkek", ru: "Бишкек", en: "Bishkek" },
  // },
  // {
  //   code: "TM",
  //   airport: "ASB",
  //   names: { uz: "Turkmaniston", ru: "Туркменистан", en: "Turkmenistan" },
  //   cityNames: { uz: "Ashxobod", ru: "Ашхабад", en: "Ashgabat" },
  // },
];

export const getCountry = (code: string | null | undefined): Country | undefined =>
  COUNTRIES.find((c) => c.code === code);

// True when a typed city is nothing more than the country's own hub — "Incheon"
// under Koreya, "Toshkent" under O'zbekiston. A card shows its cities beneath
// the country route to add detail; when both cities are just the hubs there is
// no detail to add, and the line repeats the route in smaller type.
//
// Every locale's spelling counts, not the viewer's: the author picked the
// wording when they wrote the post, and a Russian-language row saying "Инчхон"
// is the same hub to an English-language reader.
export const isHubCity = (
  country: Country,
  city: string | null | undefined,
): boolean => {
  const typed = city?.trim().toLowerCase();
  if (!typed) return false;
  return Object.values(country.cityNames).some((name) => name.toLowerCase() === typed);
};

// Every corridor the board serves has Uzbekistan on one side, so the Uzbek side
// is never a choice — it is implied by whichever other country is picked.
export const HOME_COUNTRY = "UZ";

// What the feed's country picker offers: the far side of the corridor. Picking
// one shows that corridor in both directions, so listing Uzbekistan too would
// only produce a duplicate of the entry the viewer already chose.
export const SELECTABLE_COUNTRIES: Country[] = COUNTRIES.filter(
  (c) => c.code !== HOME_COUNTRY
);

// Full list of South Korean cities (Seoul, Sejong, 6 metropolitan cities, and all "si" cities per province)
export const KOREA_CITIES = [
  "Seoul", "Busan", "Daegu", "Incheon", "Gwangju", "Daejeon", "Ulsan", "Sejong",
  // Gyeonggi-do
  "Suwon", "Seongnam", "Uijeongbu", "Anyang", "Bucheon", "Gwangmyeong", "Pyeongtaek",
  "Dongducheon", "Ansan", "Goyang", "Gwacheon", "Guri", "Namyangju", "Osan", "Siheung",
  "Gunpo", "Uiwang", "Hanam", "Yongin", "Paju", "Icheon", "Anseong", "Gimpo", "Hwaseong",
  "Yangju", "Pocheon", "Yeoju", "Gwangju (Gyeonggi)",
  // Gangwon
  "Chuncheon", "Wonju", "Gangneung", "Donghae", "Taebaek", "Sokcho", "Samcheok",
  // Chungcheongbuk-do
  "Cheongju", "Chungju", "Jecheon",
  // Chungcheongnam-do
  "Cheonan", "Gongju", "Boryeong", "Asan", "Seosan", "Nonsan", "Gyeryong", "Dangjin",
  // Jeollabuk-do
  "Jeonju", "Gunsan", "Iksan", "Jeongeup", "Namwon", "Gimje",
  // Jeollanam-do
  "Mokpo", "Yeosu", "Suncheon", "Naju", "Gwangyang",
  // Gyeongsangbuk-do
  "Pohang", "Gyeongju", "Gimcheon", "Andong", "Gumi", "Yeongju", "Yeongcheon",
  "Sangju", "Mungyeong", "Gyeongsan",
  // Gyeongsangnam-do
  "Changwon", "Jinju", "Tongyeong", "Sacheon", "Gimhae", "Miryang", "Geoje", "Yangsan",
  // Jeju-do
  "Jeju City", "Seogwipo",
];

// All 12 regions (viloyat) of Uzbekistan + Tashkent city + Republic of Karakalpakstan,
// each represented by its administrative center
export const UZBEKISTAN_REGIONS = [
  "Tashkent",       // Capital city
  "Nurafshon",      // Tashkent Region
  "Samarkand",      // Samarkand Region
  "Bukhara",        // Bukhara Region
  "Andijan",        // Andijan Region
  "Fergana",        // Fergana Region
  "Namangan",       // Namangan Region
  "Navoi",          // Navoiy Region
  "Jizzakh",        // Jizzakh Region
  "Gulistan",       // Sirdaryo Region
  "Karshi",         // Kashkadarya Region
  "Termez",         // Surkhandarya Region
  "Urgench",        // Khorezm Region
  "Nukus",          // Republic of Karakalpakstan
];
