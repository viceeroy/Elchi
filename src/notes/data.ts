import { Locale } from "../types";

// Board notes — editorial cards pinned above the live feed.
//
// These are deliberately kept apart from `Post`: they are not user content,
// never touch the API or the database, and are not filtered by the route
// selector. Everything here is authored in this file, so the copy lives with
// the component instead of in the shared translations dictionary.
//
// Only the intro card remains. The two worked examples ("this is what a
// traveler ad looks like") were scaffolding for an empty board; real posts now
// fill that role.
export type NoteKind = "intro";

export interface NoteContent {
  /** Small monospace label on the card shoulder. */
  tag: string;
  /** Right-hand meta line — a date, a hint, whatever fits the card kind. */
  meta: string;
  /** Card headline. */
  title: string;
  /** Trimmed body shown on the card (clamped). */
  summary: string;
  /** Optional image shown at the top of the expanded sheet. */
  image?: string;
  /** Full body shown in the expanded sheet; falls back to `summary`. */
  detail?: string[];
  /** Icon-labeled breakdown of the three ad kinds, shown in the expanded sheet. */
  typesList?: { icon: "traveler" | "request" | "note"; text: string }[];
}

export interface Note {
  id: string;
  kind: NoteKind;
  content: Record<Locale, NoteContent>;
}

export const NOTES: Note[] = [
  {
    id: "who-uses-it",
    kind: "intro",
    content: {
      uz: {
        tag: "Kirish",
        meta: "1/3",
        title: "Elchi kimlar uchun?",
        summary:
          "Koreya va O'zbekiston orasida chamadonida bo'sh joyi bor yo'lovchilar hamda posilka jo'natmoqchi bo'lganlar uchun.",
        image: "/who_uses_it.jpg",
        detail: [
          "Elchi — bu oddiy e'lonlar taxtasi.",
          "Agar siz uchayotgan bo'lsangiz, bo'sh joyingizni sotib, yo'l xarajatingizni qoplashingiz mumkin.",
          "Agar sizga Koreyadan O'zbekistonga (yoki teskarisi) posilka, hujjat yoki dori yuborish kerak bo'lsa, mos yo'lovchini shu yerdan topasiz.",
        ],
      },
    },
  },
  {
    id: "how-it-works",
    kind: "intro",
    content: {
      uz: {
        tag: "Qanday ishlaydi",
        meta: "2/3",
        title: "Ikki xil e'lon",
        summary:
          "Yo'lovchilar joy taklif qiladi, jo'natuvchilar posilka e'lon qiladi. Mos e'lonni topib, to'g'ridan-to'g'ri bog'lanasiz.",
        image: "/how_it_works.jpg",
        detail: [
          "E'lonni oching va uning egasi bilan Telegram yoki telefon orqali bog'laning. Tizim orqali yozishmalar yo'q.",
        ],
        typesList: [
          { icon: "traveler", text: "Yo'lovchi — uchayotgan odam chamadonidagi bo'sh joyni taklif qiladi." },
          { icon: "request", text: "So'rov — kimdir olib kelinishi kerak bo'lgan narsani yozadi." },
        ],
      },
    },
  },
  {
    id: "safety-and-payment",
    kind: "intro",
    content: {
      uz: {
        tag: "Xavfsizlik",
        meta: "3/3",
        title: "Ehtiyotkor bo'ling",
        summary:
          "Elchi to'lovlarni ushlab turmaydi va yuklarni tekshirmaydi. Kelishuv va topshirish — to'g'ridan-to'g'ri o'zaro hal qilinadi.",
        image: "/safety.jpg",
        detail: [
          "Narxni o'zaro kelishasiz. To'lovni faqat ishonch hosil qilganingizdan so'ng, yoki yukni topshirayotganda amalga oshiring.",
          "Notanish odamdan ichi yopiq va tekshirib bo'lmaydigan qutilarni olmang. Har doim yuk ichida nima borligini bilishingiz kerak.",
          "Platforma sizning o'zaro kelishuvlaringizga aralashmaydi va javobgarlikni o'z bo'yniga olmaydi.",
        ],
      },
    },
  },
];
