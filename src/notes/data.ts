import { Locale } from "../types";

// Board notes — editorial cards pinned above the live feed.
//
// These are deliberately kept apart from `Post`: they are not user content,
// never touch the API or the database, and are not filtered by the route
// selector. Everything here is authored in this file, so the copy lives with
// the component instead of in the shared translations dictionary.
export type NoteKind = "intro" | "traveler" | "request";

export interface NoteContent {
  /** Small monospace label on the card shoulder. */
  tag: string;
  /** Right-hand meta line — a date, a hint, whatever fits the card kind. */
  meta: string;
  /** Card headline. */
  title: string;
  /** Trimmed body shown on the card (clamped). */
  summary: string;
  /** Full body shown in the expanded sheet; falls back to `summary`. */
  detail?: string[];
}

export interface Note {
  id: string;
  kind: NoteKind;
  content: Record<Locale, NoteContent>;
}

export const NOTES: Note[] = [
  {
    id: "how-it-works",
    kind: "intro",
    content: {
      uz: {
        tag: "Qanday ishlaydi",
        meta: "",
        title: "Yangimisiz?",
        summary:
          "Joyi bor yo'lovchi orqali chet elga narsa yuboring — yoki O'zbekistondan kerakli mahsulotni olib kelishni so'rang.",
        detail: [
          "Elchi — e'lonlar taxtasi. Ikki xil e'lon bor:",
          "Yo'lovchi — uchayotgan odam chamadonidagi bo'sh joyni taklif qiladi.",
          "So'rov — kimdir olib kelinishi kerak bo'lgan narsani yozadi.",
          "Mos e'lonni topsangiz, uni ochib egasi bilan Telegram yoki telefon orqali bog'laning. Kelishuv, narx va topshirish — to'g'ridan-to'g'ri o'zaro hal qilinadi.",
          "Elchi to'lovni ushlab turmaydi va yuklarni tekshirmaydi. Notanish odam bilan ishlaganda ehtiyot bo'ling.",
        ],
      },
      ru: {
        tag: "Как это работает",
        meta: "",
        title: "Впервые здесь?",
        summary:
          "Отправьте посылку за границу с попутчиком, у которого есть свободное место — или попросите привезти нужный товар из Узбекистана.",
        detail: [
          "Elchi — доска объявлений. Объявления бывают двух видов:",
          "Попутчик — человек летит и предлагает свободное место в багаже.",
          "Запрос — кто-то ищет, кто привезёт нужную вещь.",
          "Нашли подходящее объявление — откройте его и свяжитесь с автором в Telegram или по телефону. Условия, цену и передачу вы обсуждаете напрямую.",
          "Elchi не хранит оплату и не проверяет груз. Будьте осторожны с незнакомыми людьми.",
        ],
      },
      en: {
        tag: "How this works",
        meta: "",
        title: "New here?",
        summary:
          "Send something overseas through a traveler with spare space — or request a specific product brought back from Uzbekistan.",
        detail: [
          "Elchi is a notice board. There are two kinds of ad:",
          "Traveler — someone is flying and offers the spare space in their luggage.",
          "Request — someone is looking for a person to bring something back.",
          "Found a match? Open it and reach the author on Telegram or by phone. Terms, price and handover are agreed directly between you.",
          "Elchi does not hold payment and does not inspect parcels. Take the usual care with strangers.",
        ],
      },
    },
  },
  {
    id: "example-traveler",
    kind: "traveler",
    content: {
      uz: {
        tag: "Yo'lovchi",
        meta: "Namuna",
        title: "Koreya → O'zbekiston",
        summary:
          "Toshkentga uchyapman, kichik narsalarni olib keta olaman — hujjat, sovg'a, dori.",
        detail: [
          "Yo'lovchi e'loni shunday ko'rinadi.",
          "Yaxshi e'londa bor: aniq sana, qancha joy qolgani (kg yoki chamadon) va nimani olib keta olmasligingiz.",
          "Uchayotgan bo'lsangiz, pastdagi «+» tugmasi orqali o'z e'loningizni joylang.",
        ],
      },
      ru: {
        tag: "Попутчик",
        meta: "Пример",
        title: "Корея → Узбекистан",
        summary:
          "Лечу в Ташкент, могу взять мелочи — документы, подарки, лекарства.",
        detail: [
          "Так выглядит объявление попутчика.",
          "В хорошем объявлении есть: точная дата, сколько места осталось (кг или чемоданы) и что вы взять не сможете.",
          "Если вы летите — разместите своё объявление кнопкой «+» внизу.",
        ],
      },
      en: {
        tag: "Traveler",
        meta: "Example",
        title: "Korea → Uzbekistan",
        summary:
          "Flying to Tashkent, can carry small items — documents, gifts, medicine.",
        detail: [
          "This is what a traveler ad looks like.",
          "A good one states: the exact date, how much room is left (kg or bags), and what you will not carry.",
          "Flying yourself? Post your own with the «+» button below.",
        ],
      },
    },
  },
  {
    id: "example-request",
    kind: "request",
    content: {
      uz: {
        tag: "So'rov",
        meta: "Namuna",
        title: "O'zbekiston → Koreya",
        summary:
          "Chorsu bozoridan qurut va quritilgan o'rik olib keladigan odam kerak.",
        detail: [
          "So'rov e'loni shunday ko'rinadi.",
          "Nima kerakligini, taxminiy og'irligini va qachongacha kerakligini yozing — sana kelishiladigan bo'lsa, buni ham belgilash mumkin.",
          "Yo'lovchilar shu e'lonlarni ko'rib, sizga o'zlari yozadi.",
        ],
      },
      ru: {
        tag: "Запрос",
        meta: "Пример",
        title: "Узбекистан → Корея",
        summary:
          "Ищу, кто привезёт курт и сушёный урюк с базара Чорсу.",
        detail: [
          "Так выглядит объявление-запрос.",
          "Напишите, что именно нужно, примерный вес и к какому сроку — дату можно указать и как «по договорённости».",
          "Попутчики видят такие объявления и пишут вам сами.",
        ],
      },
      en: {
        tag: "Request",
        meta: "Example",
        title: "Uzbekistan → Korea",
        summary:
          "Looking for someone to bring qurut and dried apricots from Chorsu bazaar.",
        detail: [
          "This is what a request ad looks like.",
          "Say what you need, the rough weight, and by when — the date can also be left flexible.",
          "Travelers browse these and reach out to you.",
        ],
      },
    },
  },
];
