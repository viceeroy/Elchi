import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const KOREA_CITIES = [
  "Seoul", "Busan", "Daegu", "Incheon", "Gwangju", "Daejeon", "Ulsan", "Sejong",
  "Suwon", "Seongnam", "Uijeongbu", "Anyang", "Bucheon", "Gwangmyeong", "Pyeongtaek",
  "Dongducheon", "Ansan", "Goyang", "Gwacheon", "Guri", "Namyangju", "Osan", "Siheung",
  "Gunpo", "Uiwang", "Hanam", "Yongin", "Paju", "Icheon", "Anseong", "Gimpo", "Hwaseong",
  "Yangju", "Pocheon", "Yeoju", "Gwangju (Gyeonggi)", "Chuncheon", "Wonju", "Gangneung",
  "Donghae", "Taebaek", "Sokcho", "Samcheok", "Cheongju", "Chungju", "Jecheon",
  "Cheonan", "Gongju", "Boryeong", "Asan", "Seosan", "Nonsan", "Gyeryong", "Dangjin",
  "Jeonju", "Gunsan", "Iksan", "Jeongeup", "Namwon", "Gimje", "Mokpo", "Yeosu",
  "Suncheon", "Naju", "Gwangyang", "Pohang", "Gyeongju", "Gimcheon", "Andong", "Gumi",
  "Yeongju", "Yeongcheon", "Sangju", "Mungyeong", "Gyeongsan", "Changwon", "Jinju",
  "Tongyeong", "Sacheon", "Gimhae", "Miryang", "Geoje", "Yangsan", "Jeju City", "Seogwipo",
];

const UZBEKISTAN_REGIONS = [
  "Tashkent", "Nurafshon", "Samarkand", "Bukhara", "Andijan", "Fergana",
  "Namangan", "Navoi", "Jizzakh", "Gulistan", "Karshi", "Termez", "Urgench", "Nukus",
];

const CATEGORIES = [
  "Hujjatlar", "Dori-darmon", "Elektronika", "Kiyimlar", "Oziq-ovqat",
  "Kitoblar", "Qadoqlar", "Boshqa"
];

const CONTACTS = [
  "@user123", "@traveler_kr", "@helper_uz", "+821012345678", "+998901234567",
  "@delivery_fast", "@cargo_uz", "@korea_helper"
];

const NOTES = [
  "Suyuqlik yo'q",
  "Ehtiyot bilan ishlang",
  "Tez yetkazib berish kerak",
  "Qadoqlangan",
  "Maxsus shartlar yo'q",
  "Kichik qadoqlar",
  "Hujjatlar muhim",
  "Breakable items",
  "Fragile - handle with care",
  "No liquids"
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

function generateRandomPost(index: number) {
  const type = Math.random() > 0.5 ? 'traveler' : 'request';
  const isK2U = Math.random() > 0.5;
  
  const from_city = isK2U ? randomItem(KOREA_CITIES) : randomItem(UZBEKISTAN_REGIONS);
  const to_city = isK2U ? randomItem(UZBEKISTAN_REGIONS) : randomItem(KOREA_CITIES);
  const direction = isK2U ? 'k2u' : 'u2k';
  
  const date = randomDate(new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  
  const weight_kg = randomInt(1, 20);
  const luggage_count = randomInt(0, 3);
  const categories = [randomItem(CATEGORIES)];
  if (Math.random() > 0.7) {
    categories.push(randomItem(CATEGORIES));
  }
  
  let weight = '';
  if (type === 'traveler') {
    if (weight_kg > 0 && luggage_count > 0) {
      weight = `${weight_kg} kg + ${luggage_count} chamadon`;
    } else if (weight_kg > 0) {
      weight = `${weight_kg} kg`;
    } else if (luggage_count > 0) {
      weight = `${luggage_count} chamadon`;
    } else {
      weight = `${randomInt(5, 15)} kg`;
    }
  } else {
    weight = `${weight_kg} kg · ${categories.join(', ')}`;
  }
  
  // Try with categories first, if that fails we'll retry without
  const category_other = null;
  
  const contact = randomItem(CONTACTS);
  const contact_type = contact.startsWith('@') ? 'telegram' : 'phone';
  
  const note = Math.random() > 0.5 ? randomItem(NOTES) : null;
  
  const postDate = new Date(date);
  postDate.setDate(postDate.getDate() + 1);
  const expires_at = postDate.toISOString().split('T')[0];
  
  return {
    type,
    from_city,
    to_city,
    date,
    weight,
    note,
    contact,
    expires_at,
  };
}

async function generatePosts() {
  console.log('Generating 10 random posts...');
  
  const posts = Array.from({ length: 10 }, (_, i) => generateRandomPost(i));
  
  console.log('Posts to insert:');
  posts.forEach((post, i) => {
    console.log(`${i + 1}. ${post.type} | ${post.from_city} → ${post.to_city} | ${post.date} | ${post.weight}`);
  });
  
  const { data, error } = await supabase
    .from('posts')
    .insert(posts)
    .select();
  
  if (error) {
    console.error('Error inserting posts:', error);
    process.exit(1);
  }
  
  console.log(`Successfully inserted ${data?.length || 0} posts!`);
  process.exit(0);
}

generatePosts().catch(console.error);
