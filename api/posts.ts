import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.js';
import { checkRateLimit, clientIp } from '../lib/rate-limit.js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Allowed request-parcel categories (mirrors the chips in PostFormModal).
const ALLOWED_CATEGORIES = new Set(['docs', 'clothes', 'meds', 'food', 'phone', 'gift', 'other']);

// Countries the board currently serves (ISO 3166-1 alpha-2). To open a new
// route (e.g. Kazakhstan), add the code here and to COUNTRIES in
// src/constants.ts — no schema change needed.
// KZ / TJ / KG / TM are ready to enable — add here + uncomment in
// src/constants.ts COUNTRIES.
const ALLOWED_COUNTRIES = new Set(['KR', 'UZ']);

// A Supabase client that acts AS the logged-in user, so row-level security sees
// their auth.uid() on insert. Built per-request from their bearer token.
function userScopedClient(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .gte('expires_at', today)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }

    return res.status(200).json(data);
  } else if (req.method === 'POST') {
    // Rate limit before any work: cap post creation per IP to blunt automated
    // flooding (the honeypot only stops naive bots).
    const allowed = await checkRateLimit('post', clientIp(req), 5, 600);
    if (!allowed) {
      return res.status(429).json({ error: 'Juda ko\'p so\'rov. Birozdan keyin urinib ko\'ring' });
    }

    // Posting requires a logged-in user. The author is taken from the verified
    // bearer token, never a body field, so it can't be spoofed.
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Avval tizimga kiring' });
    }
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user_id = userData.user?.id ?? null;
    if (userError || !user_id) {
      return res.status(401).json({ error: 'Avval tizimga kiring' });
    }

    const {
      type,
      direction,
      from_country,
      to_country,
      from_city,
      to_city,
      date,
      weight_kg,
      luggage_count,
      categories,
      category_other,
      weight,
      note,
      contact,
      contact_type,
      contact2,
      contact2_type,
      honeypot
    } = req.body || {};

    if (honeypot) {
      return res.status(400).json({ error: 'Spam aniqlandi' });
    }

    if (!type || !from_city || !to_city || !date || !weight || !contact) {
      return res.status(400).json({ error: 'Majburiy maydonlar to\'ldirilmagan' });
    }

    // Length caps — mirror the DB column widths and keep free-text fields sane
    // so a direct API caller can't store multi-MB blobs.
    const tooLong =
      String(from_city).trim().length > 100 ||
      String(to_city).trim().length > 100 ||
      String(contact).trim().length > 100 ||
      (contact2 && String(contact2).trim().length > 100) ||
      (note && String(note).length > 1000) ||
      (category_other && String(category_other).length > 100) ||
      String(weight).length > 200;
    if (tooLong) {
      return res.status(400).json({ error: 'Maydon juda uzun' });
    }

    // Categories must be a short array of known ids (the request-parcel chips).
    if (categories !== undefined && categories !== null) {
      if (!Array.isArray(categories) || categories.length > 10 ||
          !categories.every((c) => typeof c === 'string' && ALLOWED_CATEGORIES.has(c))) {
        return res.status(400).json({ error: 'Noto\'g\'ri toifa' });
      }
    }

    if (type !== 'traveler' && type !== 'request') {
      return res.status(400).json({ error: 'Noto\'g\'ri e\'lon turi' });
    }

    if (direction && direction !== 'k2u' && direction !== 'u2k') {
      return res.status(400).json({ error: 'Noto\'g\'ri yo\'nalish' });
    }

    // Route countries. New clients send them; older cached clients send only
    // the legacy direction, from which we derive the codes. The route must be
    // between two different supported countries.
    let fromCountry = typeof from_country === 'string' ? from_country.toUpperCase() : null;
    let toCountry = typeof to_country === 'string' ? to_country.toUpperCase() : null;
    if (!fromCountry && direction) {
      fromCountry = direction === 'k2u' ? 'KR' : 'UZ';
      toCountry = direction === 'k2u' ? 'UZ' : 'KR';
    }
    if (
      !fromCountry || !toCountry ||
      !ALLOWED_COUNTRIES.has(fromCountry) || !ALLOWED_COUNTRIES.has(toCountry) ||
      fromCountry === toCountry
    ) {
      return res.status(400).json({ error: 'Noto\'g\'ri yo\'nalish' });
    }

    // Keep the legacy direction column coherent for old readers while both
    // exist. Only meaningful for the KR↔UZ pair; other routes store null.
    const legacyDirection =
      fromCountry === 'KR' && toCountry === 'UZ' ? 'k2u'
      : fromCountry === 'UZ' && toCountry === 'KR' ? 'u2k'
      : null;

    const isContactType = (v: unknown) => v === 'telegram' || v === 'phone';
    if (!isContactType(contact_type) || (contact2 && !isContactType(contact2_type))) {
      return res.status(400).json({ error: 'Noto\'g\'ri aloqa turi' });
    }

    const postDate = new Date(date);
    if (isNaN(postDate.getTime())) {
      return res.status(400).json({ error: 'Noto\'g\'ri sana formati' });
    }

    // Reject dates in the past or absurdly far in the future — the latter would
    // otherwise create a post that effectively never expires.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const maxFuture = new Date(startOfToday);
    maxFuture.setDate(maxFuture.getDate() + 365);
    if (postDate < startOfToday || postDate > maxFuture) {
      return res.status(400).json({ error: 'Noto\'g\'ri sana' });
    }

    postDate.setDate(postDate.getDate() + 1);
    const expires_at = postDate.toISOString().split('T')[0];

    // Clamp numerics to sane bounds so an out-of-range value can't overflow the
    // DB column (NUMERIC(6,2) / SMALLINT) and throw a 500.
    const clamp = (n: unknown, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, Number(n) || 0));
    const safeWeightKg = clamp(weight_kg, 0, 100);
    const safeLuggage = clamp(luggage_count, 0, 20);

    // Insert AS the authenticated user so the RLS insert policy
    // (user_id = auth.uid()) is satisfied and the author is provably theirs.
    const db = userScopedClient(token);
    const { data, error } = await db
      .from('posts')
      .insert([
        {
          type,
          direction: legacyDirection,
          from_country: fromCountry,
          to_country: toCountry,
          from_city,
          to_city,
          date,
          weight_kg: safeWeightKg,
          luggage_count: safeLuggage,
          categories: Array.isArray(categories) ? categories : [],
          category_other: category_other || null,
          weight,
          note: note || null,
          contact,
          contact_type,
          contact2: contact2 || null,
          contact2_type: contact2 ? contact2_type : null,
          user_id,
          expires_at
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating post:', error);
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }

    return res.status(201).json(data);
  } else if (req.method === 'DELETE') {
    // Delete requires a logged-in user; the author is taken from the verified
    // bearer token, never a body field, so it can't be spoofed.
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Avval tizimga kiring' });
    }
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user_id = userData.user?.id ?? null;
    if (userError || !user_id) {
      return res.status(401).json({ error: 'Avval tizimga kiring' });
    }

    const id = typeof req.query.id === 'string' ? req.query.id : null;
    if (!id) {
      return res.status(400).json({ error: 'E\'lon topilmadi' });
    }

    // Delete AS the authenticated user so the RLS delete policy
    // (user_id = auth.uid()) is enforced; the explicit user_id filter is a
    // second guard so a post that isn't theirs is never touched.
    const db = userScopedClient(token);
    const { error } = await db
      .from('posts')
      .delete()
      .eq('id', id)
      .eq('user_id', user_id);

    if (error) {
      console.error('Error deleting post:', error);
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }

    return res.status(200).json({ ok: true });
  } else {
    res.setHeader('Allow', 'GET, POST, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  }
}
