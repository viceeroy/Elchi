import { Locale } from "../types";

// Board notes — editorial cards pinned above the live feed.
//
// These are deliberately kept apart from `Post`: they are not user content,
// never touch the API or the database, and are not filtered by the route
// selector or the feed chips. Everything here is authored in this file, so the
// copy lives with the component instead of in the shared translations
// dictionary.
//
// Only the intro card remains. The two worked examples ("this is what a
// traveler ad looks like") were scaffolding for an empty board; real posts and
// announcements now fill that role.
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
    id: "how-it-works",
    kind: "intro",
    content: {
      uz: {
        tag: "Qanday ishlaydi",
        meta: "",
        title: "Yangimisiz?",
        summary:
          "Joyi bor yo'lovchi orqali chet elga narsa yuboring, kerakli mahsulotni olib kelishni so'rang — yoki doimiy xizmatingizni e'lon qiling.",
        detail: [
          "Elchi — e'lonlar taxtasi. Uch xil e'lon bor:",
          "Mos e'lonni topsangiz, uni ochib egasi bilan Telegram yoki telefon orqali bog'laning. Kelishuv, narx va topshirish — to'g'ridan-to'g'ri o'zaro hal qilinadi.",
          "Elchi to'lovni ushlab turmaydi va yuklarni tekshirmaydi. Notanish odam bilan ishlaganda ehtiyot bo'ling.",
        ],
        typesList: [
          { icon: "traveler", text: "Yo'lovchi — uchayotgan odam chamadonidagi bo'sh joyni taklif qiladi." },
          { icon: "request", text: "So'rov — kimdir olib kelinishi kerak bo'lgan narsani yozadi." },
          { icon: "note", text: "E'lon — yangi qo'shildi. Yuk tashish xizmati yoki doimiy taklifingizni bitta matn bilan joylashtiring, masalan mavzu qo'shib." },
        ],
      },
      ru: {
        tag: "Как это работает",
        meta: "",
        title: "Впервые здесь?",
        summary:
          "Отправьте посылку за границу с попутчиком, попросите привезти нужный товар из Узбекистана — или разместите свою постоянную услугу.",
        detail: [
          "Elchi — доска объявлений. Объявления бывают трёх видов:",
          "Нашли подходящее объявление — откройте его и свяжитесь с автором в Telegram или по телефону. Условия, цену и передачу вы обсуждаете напрямую.",
          "Elchi не хранит оплату и не проверяет груз. Будьте осторожны с незнакомыми людьми.",
        ],
        typesList: [
          { icon: "traveler", text: "Попутчик — человек летит и предлагает свободное место в багаже." },
          { icon: "request", text: "Запрос — кто-то ищет, кто привезёт нужную вещь." },
          { icon: "note", text: "Заметка — новое. Разместите постоянную услугу (доставка, агентство) одним текстом, при желании с темой." },
        ],
      },
      en: {
        tag: "How this works",
        meta: "",
        title: "New here?",
        summary:
          "Send something overseas through a traveler with spare space, request a product brought back from Uzbekistan — or post your own standing service.",
        detail: [
          "Elchi is a notice board. There are three kinds of ad:",
          "Found a match? Open it and reach the author on Telegram or by phone. Terms, price and handover are agreed directly between you.",
          "Elchi does not hold payment and does not inspect parcels. Take the usual care with strangers.",
        ],
        typesList: [
          { icon: "traveler", text: "Traveler — someone is flying and offers the spare space in their luggage." },
          { icon: "request", text: "Request — someone is looking for a person to bring something back." },
          { icon: "note", text: "Note — new. Post a standing service (cargo run, agency) as one piece of text, with an optional theme." },
        ],
      },
    },
  },
];
