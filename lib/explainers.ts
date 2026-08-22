import type { Locale } from "../src/types";

export interface ExplainerContent {
  tag: string;
  title: string;
  routeHub: string;
  subline: string;
  image: string;
  lead?: string;
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
        title: "Elchi nima?",
        routeHub: "Koreya ↔ O‘zbekiston",
        subline: "Platforma haqida umumiy ma’lumot",
        image: "/intro.png",
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
        title: "Qanday ishlaydi?",
        routeHub: "Koreya ↔ O‘zbekiston",
        subline: "E’lon turlari va 3 bosqichli tartib",
        image: "/process.png",
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
        title: "E’lonni qanday joylash?",
        routeHub: "Koreya ↔ O‘zbekiston",
        subline: "Foydali va aniq e’lon berish",
        image: "/post.png",
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
        title: "Xavfsizlik va mas’uliyat",
        routeHub: "Koreya ↔ O‘zbekiston",
        subline: "Xavfsiz kelishuv tavsiyalari",
        image: "/safety.png",
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
