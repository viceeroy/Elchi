import { Locale } from "../types";

export interface ExplainerContent {
  tag: string;
  meta: string;
  title: string;
  image: string;
  lead?: string;
  paragraphs?: string[];
  points?: { title: string; desc: string }[];
  typesList?: { icon: "traveler" | "request"; label: string; text: string }[];
  flowSteps?: { step: number; title: string; desc: string }[];
  tips?: { icon: "map" | "calendar" | "scale" | "message"; title: string; desc: string }[];
  bullets?: string[];
  note?: string;
}

export interface Explainer {
  id: string;
  content: Record<Locale, ExplainerContent>;
}

export const EXPLAINERS: Explainer[] = [
  {
    id: "what-is-elchi",
    content: {
      uz: {
        tag: "Kirish",
        meta: "1/4",
        title: "Elchi nima?",
        image: "/explainer_intro.jpg",
        lead: "Elchi — Koreya va O‘zbekiston o‘rtasida biror narsa yubormoqchi bo‘lgan odamlar bilan shu yo‘nalishda safar qilayotgan yo‘lovchilarni bog‘laydigan bepul e’lonlar platformasi.",
        points: [
          {
            title: "Odamlarni bir-biriga topishtiradi",
            desc: "Kerakli yo‘nalish bo‘yicha uchayotgan yo‘lovchini yoki posilka yuboruvchini e’lonlar orqali osongina topasiz.",
          },
          {
            title: "Yetkazib berish xizmati emas",
            desc: "Yetkazib berish va to‘lovlarni Elchining o‘zi amalga oshirmaydi. Barcha kelishuvlar to‘g‘ridan-to‘g‘ri o‘zaro hal qilinadi.",
          },
        ],
      },
    },
  },
  {
    id: "how-it-works",
    content: {
      uz: {
        tag: "Jarayon",
        meta: "2/4",
        title: "Qanday ishlaydi?",
        image: "/explainer_how_it_works.jpg",
        lead: "Platformada ikki xil e’lon mavjud:",
        typesList: [
          {
            icon: "traveler",
            label: "Yo‘lovchi",
            text: "Koreya ↔ O‘zbekiston yo‘nalishida safar qilayotgan va boshqalarning buyumlarini olib borishga tayyor odam.",
          },
          {
            icon: "request",
            label: "Jo‘natma",
            text: "Koreya ↔ O‘zbekiston yo‘nalishida buyum yoki posilka yubormoqchi bo‘lgan odam.",
          },
        ],
        flowSteps: [
          { step: 1, title: "E’lonni toping", desc: "Asosiy sahifada mos yo‘nalish va sanani tanlang." },
          { step: 2, title: "Bog‘laning", desc: "Telegram yoki telefon orqali to‘g‘ridan-to‘g‘ri yozing." },
          { step: 3, title: "Kelishing", desc: "Narx, uchrashuv joyi va shartlarni o‘zaro kelishib oling." },
        ],
      },
    },
  },
  {
    id: "how-to-post",
    content: {
      uz: {
        tag: "Maslahat",
        meta: "3/4",
        title: "E’lonni qanday joylash kerak?",
        image: "/explainer_create_post.jpg",
        lead: "Foydali va tushunarli e’lon yaratish uchun quyidagi ma’lumotlarni aniq ko‘rsating:",
        tips: [
          {
            icon: "map",
            title: "Yo‘nalish",
            desc: "Qayerdan → qayerga (masalan: Seul → Toshkent)",
          },
          {
            icon: "calendar",
            title: "Sana",
            desc: "Aniq uchish yoki yukni jo‘natish kuni",
          },
          {
            icon: "scale",
            title: "Bo‘sh joy yoki Buyum",
            desc: "Mavjud vazn (kg) yoki buyum turi (hujjat, kiyim va h.k.)",
          },
          {
            icon: "message",
            title: "Aloqa usuli",
            desc: "Telegram username yoki to‘g‘ridan-to‘g‘ri telefon raqami",
          },
        ],
      },
    },
  },
  {
    id: "safety-and-responsibility",
    content: {
      uz: {
        tag: "Xavfsizlik",
        meta: "4/4",
        title: "Xavfsizlik va mas’uliyat",
        image: "/explainer_safety.jpg",
        lead: "Xavfsiz va ishonchli kelishuv uchun:",
        bullets: [
          "**Narx va shartlarni** oldindan kelishib oling.",
          "**Ichida nima borligini bilmagan** yoki shubhali buyumlarni qabul qilmang.",
          "**Bojxona va transport qoidalariga** rioya qiling.",
          "**To‘lov va shaxsiy ma’lumotlarda** ehtiyotkor bo‘ling.",
        ],
        note: "**Elchi odamlarni bog‘laydi.** Buyum, to‘lov va kelishuvlar foydalanuvchilarning o‘zaro mas’uliyatida.",
      },
    },
  },
];
