import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.js';
import { checkRateLimit, clientIp } from '../lib/rate-limit.js';
import { isContactKind, isValidContact, type ContactKind } from '../lib/contact.js';

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

// Columns the board renders. Read from the `public_posts` view, which omits the
// contact values and user_id entirely — those never travel in a list response.
const PUBLIC_COLUMNS =
  'id,type,direction,from_country,to_country,from_city,to_city,date,' +
  'weight_kg,luggage_count,categories,category_other,weight,headline,note,' +
  'contact_type,contact2_type,has_contact2,created_at,expires_at';

// What `?type=` narrows the list to. The default is deliberately `parcel`
// rather than `all`: a browser holding an older bundle sends no type parameter
// and has no card component for an announcement, so it must keep seeing exactly
// what it saw before. The current client asks for `all` explicitly.
const TYPE_FILTERS: Record<string, string[] | null> = {
  parcel: ['traveler', 'request'],
  announcement: ['announcement'],
  all: null,
};

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

// Post ids are UUIDs. Checking the shape here turns a malformed id into a 400
// instead of letting Postgres reject the cast and surface as a 500.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function postId(req: VercelRequest): string | null {
  const raw = typeof req.query.id === 'string' ? req.query.id : null;
  return raw && UUID_RE.test(raw) ? raw : null;
}

// Resolves the caller's user id from a bearer token, or null when absent or
// invalid. Never throws — an unauthenticated GET is a normal case.
async function resolveUser(req: VercelRequest): Promise<{ id: string; token: string } | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return { id: data.user.id, token };
}

// Marks which of the returned posts belong to the caller, so the client can
// show its delete button without user_id ever being exposed to other viewers.
async function markOwnership(
  posts: Array<Record<string, unknown>>,
  user: { id: string; token: string } | null,
) {
  if (!user || posts.length === 0) {
    return posts.map((p) => ({ ...p, is_mine: false }));
  }
  const db = userScopedClient(user.token);
  const { data, error } = await db
    .from('posts')
    .select('id')
    .eq('user_id', user.id)
    .in('id', posts.map((p) => p.id as string));

  if (error) {
    console.error('Error resolving post ownership:', error);
    return posts.map((p) => ({ ...p, is_mine: false }));
  }
  const mine = new Set((data ?? []).map((row) => row.id as string));
  return posts.map((p) => ({ ...p, is_mine: mine.has(p.id as string) }));
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  // Post data is personal (free-text notes, routes, and — behind auth — phone
  // numbers). Never let an edge or intermediary cache a response.
  res.setHeader('Cache-Control', 'private, no-store');

  // Loose per-IP cap on reads. Deliberately generous: a large share of users in
  // both corridors are behind carrier-grade NAT, so many people share one
  // address and a tight cap here would lock out real traffic. This is a
  // denial-of-service guard, not the privacy control — the feed carries no
  // contact values, and the reveal path below is what's actually throttled.
  const allowedRead = await checkRateLimit('read', clientIp(req), 600, 600);
  if (!allowedRead) {
    return res.status(429).json({ error: 'Juda ko\'p so\'rov. Birozdan keyin urinib ko\'ring' });
  }

  const id = postId(req);
  const wantsContact = req.query.fields === 'contact';

  // --- Contact reveal: the sensitive path. ------------------------------
  // One post per call, logged-in callers only, rate limited on the user id
  // rather than the IP so an account (not a proxy pool) is the cost of
  // scraping. get_post_contact enforces the auth requirement server-side too.
  if (wantsContact) {
    if (!id) {
      return res.status(400).json({ error: 'E\'lon topilmadi' });
    }
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Avval tizimga kiring' });
    }

    // Two buckets. The per-user cap is the real control: an account is the
    // cost of scraping, and it can be revoked. The per-IP cap is a backstop so
    // one host can't drive the reveal endpoint through a pile of throwaway
    // accounts — loose enough to survive shared/NAT addresses.
    const perUser = await checkRateLimit('contact', `user:${user.id}`, 60, 600);
    const perIp = perUser && await checkRateLimit('contact-ip', clientIp(req), 240, 600);
    if (!perUser || !perIp) {
      return res.status(429).json({ error: 'Juda ko\'p so\'rov. Birozdan keyin urinib ko\'ring' });
    }

    const db = userScopedClient(user.token);
    const { data, error } = await db.rpc('get_post_contact', { p_id: id });
    if (error) {
      console.error('Error fetching post contact:', error);
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return res.status(404).json({ error: 'E\'lon topilmadi' });
    }
    return res.status(200).json(row);
  }

  const user = await resolveUser(req);

  // --- Single post (deep links: ?postId=... may point outside page 1). ---
  if (id) {
    const { data, error } = await supabase
      .from('public_posts')
      .select(PUBLIC_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching post:', error);
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }
    if (!data) {
      return res.status(404).json({ error: 'E\'lon topilmadi' });
    }
    // The project has no generated Supabase types, so a select() over an
    // explicit column list comes back as an opaque row shape.
    const row = data as unknown as Record<string, unknown>;
    const [withOwnership] = await markOwnership([row], user);
    return res.status(200).json(withOwnership);
  }

  // --- Paged list. ------------------------------------------------------
  // The route filter runs in SQL, not in the browser, so a bounded page can't
  // starve a quiet corridor of results the way a global "newest N" would.
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(MAX_PAGE_SIZE, Math.floor(rawLimit))
    : DEFAULT_PAGE_SIZE;
  const rawOffset = Number(req.query.offset);
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  let query = supabase
    .from('public_posts')
    .select(PUBLIC_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit); // one extra row to detect a next page

  // Which kind of ad the feed wants. The count is on the same query, so `total`
  // and the fetch-one-extra `hasMore` above both stay correct per filter.
  const rawType = typeof req.query.type === 'string' ? req.query.type : 'parcel';
  if (!(rawType in TYPE_FILTERS)) {
    return res.status(400).json({ error: 'Noto\'g\'ri e\'lon turi' });
  }
  const typeFilter = TYPE_FILTERS[rawType];
  if (typeFilter) {
    query = query.in('type', typeFilter);
  }

  // The country filter reads differently per type, so it can't be one pair of
  // .eq() calls any more: a parcel post travels FROM one country TO another,
  // while an announcement simply sits in one. Both are keyed off `from_country`
  // — for a parcel that's the origin, for an announcement it's the location —
  // so the country the viewer has selected matches the same column either way.
  const from = typeof req.query.from === 'string' ? req.query.from.toUpperCase() : null;
  const to = typeof req.query.to === 'string' ? req.query.to.toUpperCase() : null;
  if (from && to) {
    if (!ALLOWED_COUNTRIES.has(from) || !ALLOWED_COUNTRIES.has(to) || from === to) {
      return res.status(400).json({ error: 'Noto\'g\'ri yo\'nalish' });
    }
    if (rawType === 'announcement') {
      query = query.eq('from_country', from);
    } else if (rawType === 'parcel') {
      query = query.eq('from_country', from).eq('to_country', to);
    } else {
      // Mixed feed: each type keeps its own rule. Interpolation is safe here
      // because both codes have just been checked against ALLOWED_COUNTRIES,
      // so they can only ever be one of the literals in that set.
      query = query.or(
        `and(type.in.(traveler,request),from_country.eq.${from},to_country.eq.${to}),` +
        `and(type.eq.announcement,from_country.eq.${from})`
      );
    }
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('Error fetching posts:', error);
    return res.status(500).json({ error: 'Xatolik yuz berdi' });
  }

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const hasMore = rows.length > limit;
  const page = await markOwnership(hasMore ? rows.slice(0, limit) : rows, user);

  return res.status(200).json({
    posts: page,
    hasMore,
    total: count ?? offset + page.length,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    // Loose per-IP backstop before any work, so unauthenticated flooding is
    // turned away cheaply.
    const ipAllowed = await checkRateLimit('post-ip', clientIp(req), 40, 600);
    if (!ipAllowed) {
      return res.status(429).json({ error: 'Juda ko\'p so\'rov. Birozdan keyin urinib ko\'ring' });
    }

    // Posting requires a logged-in user. The author is taken from the verified
    // bearer token, never a body field, so it can't be spoofed.
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Avval tizimga kiring' });
    }
    const { id: user_id, token } = user;

    // The real cap is per author, not per address. Keying this on the IP made
    // sense only while the IP was forgeable and the limit therefore toothless;
    // now that clientIp() returns the true peer, a per-IP cap of 5 would lock
    // out everyone sharing a carrier-grade NAT address.
    const allowed = await checkRateLimit('post', `user:${user_id}`, 5, 600);
    if (!allowed) {
      return res.status(429).json({ error: 'Juda ko\'p so\'rov. Birozdan keyin urinib ko\'ring' });
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
      headline,
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

    // Normalise once, up front, and use these values for every check AND for
    // the insert. The previous code measured `from_city.trim().length` but
    // stored the untrimmed string, so 100 characters plus padding passed
    // validation and then blew up against VARCHAR(100) as a 500.
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const fromCity = str(from_city);
    const toCity = str(to_city);
    const contactVal = str(contact);
    const contact2Val = str(contact2);
    const headlineVal = str(headline);
    const noteVal = str(note);
    const categoryOtherVal = str(category_other);
    const weightVal = str(weight);

    // The type gate runs before the required-field gate, because what counts as
    // required depends on it: an announcement carries no city, date or cargo.
    if (type !== 'traveler' && type !== 'request' && type !== 'announcement') {
      return res.status(400).json({ error: 'Noto\'g\'ri e\'lon turi' });
    }
    const isAnnouncement = type === 'announcement';

    // Shared by both shapes — every ad needs a way to reach its author.
    if (!contactVal) {
      return res.status(400).json({ error: 'Majburiy maydonlar to\'ldirilmagan' });
    }

    if (isAnnouncement) {
      // A standing ad: headline + body + route + contact, nothing else. The
      // parcel fields are not read, so a caller can't smuggle a date or cargo
      // onto one — the row literal below hard-codes them.
      if (!headlineVal || !noteVal) {
        return res.status(400).json({ error: 'Majburiy maydonlar to\'ldirilmagan' });
      }
      if (
        headlineVal.length > 80 ||
        noteVal.length > 500 ||
        contactVal.length > 100 ||
        contact2Val.length > 100
      ) {
        return res.status(400).json({ error: 'Maydon juda uzun' });
      }
    } else {
      if (!fromCity || !toCity || !date || !weightVal) {
        return res.status(400).json({ error: 'Majburiy maydonlar to\'ldirilmagan' });
      }

      // Length caps — mirror the DB column widths and keep free-text fields sane
      // so a direct API caller can't store multi-MB blobs.
      const tooLong =
        fromCity.length > 100 ||
        toCity.length > 100 ||
        contactVal.length > 100 ||
        contact2Val.length > 100 ||
        noteVal.length > 1000 ||
        categoryOtherVal.length > 100 ||
        weightVal.length > 200;
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

      if (direction && direction !== 'k2u' && direction !== 'u2k') {
        return res.status(400).json({ error: 'Noto\'g\'ri yo\'nalish' });
      }
    }

    // Route countries. New clients send them; older cached clients send only
    // the legacy direction, from which we derive the codes. The route must be
    // between two different supported countries.
    let fromCountry = typeof from_country === 'string' ? from_country.toUpperCase() : null;
    let toCountry = typeof to_country === 'string' ? to_country.toUpperCase() : null;

    if (isAnnouncement) {
      // An announcement sits in one country — it is a standing service, not a
      // delivery in a direction. The single country is stored in from_country
      // (which is what the feed's country filter reads) and to_country is left
      // null; anything the caller sent for it is discarded rather than trusted.
      toCountry = null;
      if (!fromCountry || !ALLOWED_COUNTRIES.has(fromCountry)) {
        return res.status(400).json({ error: 'Noto\'g\'ri davlat' });
      }
    } else {
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
    }

    // Keep the legacy direction column coherent for old readers while both
    // exist. Only meaningful for the KR↔UZ pair; other routes store null, and
    // an announcement has no direction at all.
    const legacyDirection =
      isAnnouncement ? null
      : fromCountry === 'KR' && toCountry === 'UZ' ? 'k2u'
      : fromCountry === 'UZ' && toCountry === 'KR' ? 'u2k'
      : null;

    if (!isContactKind(contact_type) || (contact2Val && !isContactKind(contact2_type))) {
      return res.status(400).json({ error: 'Noto\'g\'ri aloqa turi' });
    }

    // The handle must match the channel it claims to be. Previously only the
    // length was checked, so `contact_type` and `contact` could disagree — and
    // the UI, which decided tel: vs t.me by sniffing a leading "@", would then
    // build a link that contradicted the stored type.
    if (!isValidContact(contactVal, contact_type)) {
      return res.status(400).json({ error: 'Aloqa ma\'lumoti noto\'g\'ri' });
    }
    if (contact2Val && !isValidContact(contact2Val, contact2_type as ContactKind)) {
      return res.status(400).json({ error: 'Aloqa ma\'lumoti noto\'g\'ri' });
    }

    // Two shapes have no fixed date: an announcement never has one, and
    // "flexible" means the requester negotiates it directly with the traveler.
    // Both store NULL — the string "flexible" used to be passed straight into
    // the DATE column, which failed the insert — and both get a flat 30-day
    // expiry instead of one derived from a travel date.
    const noFixedDate = isAnnouncement || date === 'flexible';
    let dateValue: string | null;
    let expires_at: string;

    if (noFixedDate) {
      dateValue = null;
      const flexibleExpiry = new Date();
      flexibleExpiry.setHours(0, 0, 0, 0);
      flexibleExpiry.setDate(flexibleExpiry.getDate() + 30);
      expires_at = flexibleExpiry.toISOString().split('T')[0];
    } else {
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
      expires_at = postDate.toISOString().split('T')[0];
    }

    // Clamp numerics to sane bounds so an out-of-range value can't overflow the
    // DB column (NUMERIC(6,2) / SMALLINT) and throw a 500.
    const clamp = (n: unknown, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, Number(n) || 0));
    const safeWeightKg = clamp(weight_kg, 0, 100);
    const safeLuggage = clamp(luggage_count, 0, 20);

    // Both shapes share the route and contact columns; they differ in whether
    // the cargo half is populated at all. The announcement literal hard-codes
    // the parcel fields rather than passing anything through, so the values
    // match posts_shape_by_type_check no matter what the caller sent.
    //
    // `weight: ''` rather than null — the feed card matches on that string
    // without a guard, so an older bundle that deep-links an announcement must
    // not meet a null there.
    const row = isAnnouncement
      ? {
          type,
          direction: legacyDirection,
          from_country: fromCountry,
          to_country: null,
          from_city: null,
          to_city: null,
          date: null,
          weight_kg: 0,
          luggage_count: 0,
          categories: [],
          category_other: null,
          weight: '',
          headline: headlineVal,
          note: noteVal,
          contact: contactVal,
          contact_type,
          contact2: contact2Val || null,
          contact2_type: contact2Val ? contact2_type : null,
          user_id,
          expires_at
        }
      : {
          type,
          direction: legacyDirection,
          from_country: fromCountry,
          to_country: toCountry,
          // The normalised values, so what was validated is what gets stored.
          from_city: fromCity,
          to_city: toCity,
          date: dateValue,
          weight_kg: safeWeightKg,
          luggage_count: safeLuggage,
          categories: Array.isArray(categories) ? categories : [],
          category_other: categoryOtherVal || null,
          weight: weightVal,
          headline: null,
          note: noteVal || null,
          contact: contactVal,
          contact_type,
          contact2: contact2Val || null,
          contact2_type: contact2Val ? contact2_type : null,
          user_id,
          expires_at
        };

    // Insert AS the authenticated user so the RLS insert policy
    // (user_id = auth.uid()) is satisfied and the author is provably theirs.
    const db = userScopedClient(token);
    const { data, error } = await db
      .from('posts')
      .insert([row])
      // Only the id comes back: `authenticated` holds a column-level SELECT
      // grant on (id, user_id) and nothing more, so `.select()` with no
      // argument would now fail on the contact columns.
      .select('id')
      .single();

    if (error) {
      // 23505 is raised by the one_active_announcement trigger, not by a real
      // unique constraint — `posts` has none besides the primary key. Hitting
      // the per-author cap is a normal outcome, so it gets its own status and
      // a message the form can show, rather than a generic failure.
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'Sizda allaqachon faol e\'lon bor. Avval eskisini o\'chiring.'
        });
      }
      console.error('Error creating post:', error);
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }

    return res.status(201).json({ id: data.id });
  } else if (req.method === 'DELETE') {
    // Delete requires a logged-in user; the author is taken from the verified
    // bearer token, never a body field, so it can't be spoofed.
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Avval tizimga kiring' });
    }
    const { id: user_id, token } = user;

    // Deletion is authz-safe (RLS scopes it to the author), so this is an abuse
    // cap only: nobody legitimately deletes 30 posts in ten minutes.
    const allowed = await checkRateLimit('delete', `user:${user_id}`, 30, 600);
    if (!allowed) {
      return res.status(429).json({ error: 'Juda ko\'p so\'rov. Birozdan keyin urinib ko\'ring' });
    }

    const id = postId(req);
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
