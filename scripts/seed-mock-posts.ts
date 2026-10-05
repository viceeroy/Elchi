import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually if present
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const MOCK_POSTS = [
  {
    type: 'traveler' as const,
    direction: 'k2u' as const,
    from_country: 'KR',
    to_country: 'UZ',
    from_city: 'Seoul',
    to_city: 'Toshkent',
    date: '2026-10-09',
    weight_kg: 15,
    luggage_count: 1,
    categories: [],
    category_other: null,
    weight: '15 kg + 1 chamadon',
    headline: null,
    note: "Incheon aeroportidan Toshkentga uchaman. Bo'sh joy bor, faqat toza va ruxsat etilgan buyumlar, kiyim va hujjatlar olinadi.",
    contact: '@sardor_travels',
    contact_type: 'telegram' as const,
    contact2: '+82 10-2345-6789',
    contact2_type: 'phone' as const,
    contact3: '+998 90 123 45 67',
    contact3_type: 'phone' as const,
    expires_at: '2026-10-10',
  },
  {
    type: 'request' as const,
    direction: 'u2k' as const,
    from_country: 'UZ',
    to_country: 'KR',
    from_city: 'Toshkent',
    to_city: 'Seoul',
    date: '2026-10-12',
    weight_kg: 2,
    luggage_count: 0,
    categories: ['docs', 'gift'],
    category_other: null,
    weight: "2 kg · Hujjatlar, Sovg'a",
    headline: null,
    note: "Universitet uchun diplom va apostil hujjatlari hamda kichik esdalik sovg'asi. Incheon yoki Seulda kutib olinadi.",
    contact: '@madina_tashkent',
    contact_type: 'telegram' as const,
    contact2: '+998 93 555 12 34',
    contact2_type: 'phone' as const,
    contact3: null,
    contact3_type: null,
    expires_at: '2026-10-13',
  },
  {
    type: 'traveler' as const,
    direction: 'k2u' as const,
    from_country: 'KR',
    to_country: 'UZ',
    from_city: 'Busan',
    to_city: 'Samarqand',
    date: '2026-10-11',
    weight_kg: 23,
    luggage_count: 0,
    categories: [],
    category_other: null,
    weight: '23 kg',
    headline: null,
    note: "Busandan Samarqandga to'g'ridan-to'g'ri reys. Katta sumkada joy bor. Suyuqlik va tamaki olinmaydi.",
    contact: '+82 10-9876-5432',
    contact_type: 'phone' as const,
    contact2: '@jasur_busan',
    contact2_type: 'telegram' as const,
    contact3: null,
    contact3_type: null,
    expires_at: '2026-10-12',
  },
  {
    type: 'request' as const,
    direction: 'u2k' as const,
    from_country: 'UZ',
    to_country: 'KR',
    from_city: 'Andijon',
    to_city: 'Ansan',
    date: '2026-10-15',
    weight_kg: 5,
    luggage_count: 0,
    categories: ['clothes', 'food'],
    category_other: null,
    weight: '5 kg · Kiyim-kechak, Oziq-ovqat',
    headline: null,
    note: 'Milliy chopon, quruq mevalar va qandolat mahsulotlari. Hammasi xavfsiz va germetik qadoqlangan.',
    contact: '@nodirbek_andijan',
    contact_type: 'telegram' as const,
    contact2: '+998 97 777 88 99',
    contact2_type: 'phone' as const,
    contact3: null,
    contact3_type: null,
    expires_at: '2026-10-16',
  },
  {
    type: 'traveler' as const,
    direction: 'k2u' as const,
    from_country: 'KR',
    to_country: 'UZ',
    from_city: 'Daegu',
    to_city: "Farg'ona",
    date: '2026-10-14',
    weight_kg: 8,
    luggage_count: 0,
    categories: [],
    category_other: null,
    weight: '8 kg',
    headline: null,
    note: "Qo'l yukida (ruchnoy) bo'sh joy bor. Shoshilinch hujjatlar va kichik noutbuk yoki planshet yetkaza olaman.",
    contact: '@ulugbek_daegu',
    contact_type: 'telegram' as const,
    contact2: '+82 10-3344-5566',
    contact2_type: 'phone' as const,
    contact3: null,
    contact3_type: null,
    expires_at: '2026-10-15',
  },
  {
    type: 'request' as const,
    direction: 'u2k' as const,
    from_country: 'UZ',
    to_country: 'KR',
    from_city: 'Buxoro',
    to_city: 'Suwon',
    date: '2026-10-18',
    weight_kg: 1,
    luggage_count: 0,
    categories: ['meds'],
    category_other: null,
    weight: '1 kg · Dori-darmon',
    headline: null,
    note: 'Shifokor retsepti va rasmiy cheki ilova qilingan dori vositalari. Gospitalda yotgan bemor uchun juda zarur.',
    contact: '+998 91 444 33 22',
    contact_type: 'phone' as const,
    contact2: '@shahzod_bukhara',
    contact2_type: 'telegram' as const,
    contact3: null,
    contact3_type: null,
    expires_at: '2026-10-19',
  },
  {
    type: 'traveler' as const,
    direction: 'k2u' as const,
    from_country: 'KR',
    to_country: 'UZ',
    from_city: 'Incheon',
    to_city: 'Namangan',
    date: '2026-10-20',
    weight_kg: 0,
    luggage_count: 2,
    categories: [],
    category_other: null,
    weight: '2 chamadon',
    headline: null,
    note: "Ikkita to'liq bo'sh chamadon bor. Toshkent aeroportida yoki Namanganning markazida topshirishim mumkin.",
    contact: '@abror_incheon',
    contact_type: 'telegram' as const,
    contact2: '+82 10-7788-9900',
    contact2_type: 'phone' as const,
    contact3: null,
    contact3_type: null,
    expires_at: '2026-10-21',
  },
  {
    type: 'request' as const,
    direction: null,
    from_country: 'RU',
    to_country: 'UZ',
    from_city: 'Moskva',
    to_city: 'Toshkent',
    date: '2026-10-16',
    weight_kg: 3,
    luggage_count: 0,
    categories: ['phone', 'docs'],
    category_other: null,
    weight: '3 kg · Telefon/Texnika, Hujjatlar',
    headline: null,
    note: 'Yangi smartfon (zavod qutisida) va muhim rasmiy hujjatlar. Moskvada istalgan metro bekatida yetkazib beraman.',
    contact: '+7 925 123 45 67',
    contact_type: 'phone' as const,
    contact2: '@dilshod_moscow',
    contact2_type: 'telegram' as const,
    contact3: null,
    contact3_type: null,
    expires_at: '2026-10-17',
  },
  {
    type: 'traveler' as const,
    direction: null,
    from_country: 'UZ',
    to_country: 'RU',
    from_city: 'Toshkent',
    to_city: 'Moskva',
    date: '2026-10-17',
    weight_kg: 10,
    luggage_count: 1,
    categories: [],
    category_other: null,
    weight: '10 kg + 1 chamadon',
    headline: null,
    note: "Toshkentdan Moskvaga (Domodedovo) uchaman. Ortiqcha bagaj joyi bor. Yetkazib berish xizmati kelishilgan narxda.",
    contact: '@kamol_tashkent',
    contact_type: 'telegram' as const,
    contact2: '+998 90 999 00 11',
    contact2_type: 'phone' as const,
    contact3: null,
    contact3_type: null,
    expires_at: '2026-10-18',
  },
  {
    type: 'request' as const,
    direction: 'k2u' as const,
    from_country: 'KR',
    to_country: 'UZ',
    from_city: 'Gwangju',
    to_city: 'Urganch',
    date: '2026-10-22',
    weight_kg: 4,
    luggage_count: 0,
    categories: ['clothes', 'gift'],
    category_other: null,
    weight: "4 kg · Kiyim-kechak, Sovg'a",
    headline: null,
    note: "Bolalar uchun qishki kiyimlar va bayram sovg'alari. Urganch aeroportida kutib olinadi.",
    contact: '@zilola_gwangju',
    contact_type: 'telegram' as const,
    contact2: '+82 10-5566-7788',
    contact2_type: 'phone' as const,
    contact3: null,
    contact3_type: null,
    expires_at: '2026-10-23',
  },
];

async function seed() {
  console.log(`Seeding ${MOCK_POSTS.length} mock posts to Supabase...`);
  const { data, error } = await supabase.from('posts').insert(MOCK_POSTS).select('id, type, from_city, to_city');
  if (error) {
    console.error('Error inserting mock posts:', error);
    process.exit(1);
  }
  console.log(`Successfully inserted ${data?.length} posts!`);
  console.log(data);
}

if (process.argv[1]?.endsWith('seed-mock-posts.ts')) {
  seed().catch(console.error);
}
