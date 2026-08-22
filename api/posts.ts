import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.js';
import { checkRateLimit, clientIp } from '../lib/rate-limit.js';
import { verifyAccessToken } from '../lib/verify-token.js';
import { isContactKind, isValidContact, type ContactKind } from '../lib/contact.js';
import { PARCEL_CITY_MAX, PARCEL_CATEGORY_OTHER_MAX, PARCEL_NOTE_MAX } from '../lib/parcelLimits.js';
import { PARCEL_CATEGORY_IDS } from '../lib/parcelCategories.js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Allowed request-parcel categories, plus 'other' — the sentinel the client
// never sends as a category id, since a custom type goes in category_other.
const ALLOWED_CATEGORIES = new Set<string>([...PARCEL_CATEGORY_IDS, 'other']);

// Countries the board currently serves (ISO 3166-1 alpha-2). To open a new
// route (e.g. Kazakhstan), add the code here and to COUNTRIES in
// src/constants.ts — no schema change needed.
// KZ / TJ / KG / TM are ready to enable — add here + uncomment in
// src/constants.ts COUNTRIES.
const ALLOWED_COUNTRIES = new Set(['KR', 'UZ']);

// Every corridor the board serves has Uzbekistan on one side, so the Uzbek side
// is implied rather than requested. Mirrors HOME_COUNTRY in src/constants.ts.
const HOME_COUNTRY = 'UZ';

// DEV ONLY — lets an unregistered visitor post while the composer is being
// tested locally. Off unless ELCHI_DEV_NO_AUTH=1 AND a service-role key is
// present, because bypassing the 401 alone achieves nothing: the RLS insert
// policy still demands a real auth.uid().
//
// The environment check is the third condition and it is not redundant: "must
// never be set in production" was a comment, and a comment does not survive
// someone copying an env var between Vercel environments. VERCEL_ENV is set by
// the platform on every deployment (production / preview / development) and
// cannot be reached by a request, so a deployed function refuses the bypass
// whatever the other two say.
const DEV_NO_AUTH =
  process.env.ELCHI_DEV_NO_AUTH === '1' &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.VERCEL_ENV !== 'production' &&
  process.env.NODE_ENV !== 'production';

// The service-role client bypasses row-level security. Only reachable from the
// DEV_NO_AUTH path above; every real request still inserts as its author.
function serviceClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || '', {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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
// display_name is the author's chosen name, joined in by the view from
// `profiles`; it is the one piece of author identity a list response carries,
// and it carries no way to reach that author.
const PUBLIC_COLUMNS =
  'id,type,direction,from_country,to_country,from_city,to_city,date,' +
  'weight_kg,luggage_count,categories,category_other,weight,note,' +
  'contact_type,contact2_type,has_contact2,display_name,created_at,expires_at';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

// Reject request bodies larger than this before parsing. Vercel's default limit
// is 4.5 MB, but no legitimate post or auth payload is larger than a few KB.
const MAX_BODY_BYTES = 10_000;

// Post ids are UUIDs. Checking the shape here turns a malformed id into a 400
// instead of letting Postgres reject the cast and surface as a 500.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function postId(req: VercelRequest): string | null {
  const raw = typeof req.query.id === 'string' ? req.query.id : null;
  return raw && UUID_RE.test(raw) ? raw : null;
}

// Resolves the caller's user id from a bearer token, or null when absent or
// invalid. Never throws — an unauthenticated GET is a normal case.
//
// The verification itself is memoised per token on the warm instance — see
// lib/verify-token.ts for why that is safe and what it saves. The token still
// travels back out with the id, because every write path builds a user-scoped
// PostgREST client from it and RLS, not this function, is the security
// boundary.
async function resolveUser(req: VercelRequest): Promise<{ id: string; token: string } | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const id = await verifyAccessToken(token);
  return id ? { id, token } : null;
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
    console.error('Error resolving post ownership:', { message: error.message, code: error.code });
    return posts.map((p) => ({ ...p, is_mine: false }));
  }
  const mine = new Set((data ?? []).map((row) => row.id as string));
  return posts.map((p) => ({ ...p, is_mine: mine.has(p.id as string) }));
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  // By default, the list and single-post endpoints are public and cached by
  // the edge so concurrent visitors share the same response. Contact reveal
  // overrides this to private below.
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

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
    // Overwrite the public cache header: contact values must never be cached.
    res.setHeader('Cache-Control', 'private, no-store');

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
    const perUser = await checkRateLimit('contact', `user:${user.id}`, 60, 600, false);
    const perIp = perUser && await checkRateLimit('contact-ip', clientIp(req), 240, 600, false);
    if (!perUser || !perIp) {
      return res.status(429).json({ error: 'Juda ko\'p so\'rov. Birozdan keyin urinib ko\'ring' });
    }

    const db = userScopedClient(user.token);
    const { data, error } = await db.rpc('get_post_contact', { p_id: id });
    if (error) {
      console.error('Error fetching post contact:', { message: error.message, code: error.code });
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return res.status(404).json({ error: 'E\'lon topilmadi' });
    }
    return res.status(200).json(row);
  }

  // --- Single post (deep links: ?postId=... may point outside page 1). ---
  if (id) {
    // The row lookup and the token check are independent — the query is not
    // scoped by the caller, who only decides `is_mine` afterwards. Resolving the
    // user used to happen first and cost a full round trip to the auth server
    // before the post query had even been sent. Both start here instead.
    //
    // resolveUser is called inside the branch rather than above it so that no
    // validation early-return can leave it in flight: its "never throws"
    // contract covers a bad token, not a network failure, and a floating
    // rejection on a serverless invocation is an unhandled rejection.
    const [{ data, error }, user] = await Promise.all([
      supabase
        .from('public_posts')
        .select(PUBLIC_COLUMNS)
        .eq('id', id)
        .maybeSingle(),
      resolveUser(req),
    ]);

    if (error) {
      console.error('Error fetching post:', { message: error.message, code: error.code });
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
    .select(PUBLIC_COLUMNS)
    .order('date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit); // one extra row to detect a next page

  // No `{ count: 'exact' }`. It made PostgREST run a second, unbounded COUNT
  // over the whole filtered set on every feed request — work proportional to the
  // board rather than to the page, and it cannot stop at LIMIT the way the row
  // query does. The only thing it fed was a `total` in the response, and the
  // "N active posts" label that read it was deleted in cdfd528. Paging runs on
  // the fetch-one-extra `hasMore` above, which costs one row.
  //
  // `?type=` is gone with the announcement board — there is one kind of ad
  // left, so there is nothing to narrow to. The parameter is deliberately
  // IGNORED rather than validated: a browser holding a cached bundle still
  // sends `type=parcel`, `type=announcement` or `type=all`, and rejecting those
  // would turn the old notes tab into an error toast instead of a feed. Every
  // one of them now means the same thing.
  //
  // The filter itself stays, applied to the same query the rows come from so
  // `hasMore` stays correct: public_posts already hides the retired
  // announcement rows, and this is the second half of that — the read model and
  // the API agree on what a post is.
  query = query.in('type', ['traveler', 'request']);

  // The country filter selects a CORRIDOR, not a direction: `?country=KR` means
  // the KR↔UZ corridor, so a Korea→Uzbekistan parcel and an Uzbekistan→Korea
  // one both match. Direction is content on each individual post, never a filter.
  //
  // A post travels FROM one country TO the other, so its route identifies its
  // corridor outright — which is why the corridor_country column that
  // announcements needed is gone rather than merely unused.
  //
  // `from`/`to` are the legacy directional parameters, still accepted so a
  // browser holding an older bundle keeps getting a filtered feed. Either side
  // of the pair identifies the same corridor, so the non-Uzbek one is used.
  const rawCountry = typeof req.query.country === 'string' ? req.query.country : null;
  const legacyFrom = typeof req.query.from === 'string' ? req.query.from : null;
  const legacyTo = typeof req.query.to === 'string' ? req.query.to : null;
  const country = (rawCountry
    ?? [legacyFrom, legacyTo].find((c) => c && c.toUpperCase() !== HOME_COUNTRY)
    ?? legacyFrom
  )?.toUpperCase() ?? null;
  if (country) {
    if (!ALLOWED_COUNTRIES.has(country) || country === HOME_COUNTRY) {
      return res.status(400).json({ error: 'Noto\'g\'ri yo\'nalish' });
    }
    // Interpolation is safe here because the code has just been checked against
    // ALLOWED_COUNTRIES, so it can only ever be one of the literals in that set.
    query = query.or(
      `and(from_country.eq.${country},to_country.eq.${HOME_COUNTRY}),` +
      `and(from_country.eq.${HOME_COUNTRY},to_country.eq.${country})`
    );
  }

  // Same independence as the single-post branch above, and the same reason for
  // calling resolveUser only here: every 400 on the filters has already been
  // returned, so nothing can be left in flight.
  const [{ data, error }, user] = await Promise.all([query, resolveUser(req)]);
  if (error) {
    console.error('Error fetching posts:', { message: error.message, code: error.code });
    return res.status(500).json({ error: 'Xatolik yuz berdi' });
  }

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const hasMore = rows.length > limit;
  const page = await markOwnership(hasMore ? rows.slice(0, limit) : rows, user);

  // `total` is gone with the count that produced it. Dropping the key rather
  // than sending `offset + page.length` in its place is deliberate: that number
  // is not the total, and a stale cached bundle from before cdfd528 guards with
  // `typeof data.total === "number"` and falls back to the page length on its
  // own. An absent key degrades; a wrong one is believed.
  return res.status(200).json({
    posts: page,
    hasMore,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    // Reject oversized bodies before any work. No legitimate post payload
    // exceeds a few KB; this stops multi-MB JSON bombs from being parsed.
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'So\'rov juda katta' });
    }

    // Loose per-IP backstop before any work, so unauthenticated flooding is
    // turned away cheaply.
    const ipAllowed = await checkRateLimit('post-ip', clientIp(req), 40, 600);
    if (!ipAllowed) {
      return res.status(429).json({ error: 'Juda ko\'p so\'rov. Birozdan keyin urinib ko\'ring' });
    }

    // Posting requires a logged-in user. The author is taken from the verified
    // bearer token, never a body field, so it can't be spoofed.
    //
    // DEV_NO_AUTH lifts that for local testing only. It needs the service-role
    // key, because the RLS insert policy is `auth.uid() IS NOT NULL AND
    // user_id = auth.uid()` — with the anon key there is no way to insert
    // without a real session, whatever this handler does. Rows written this way
    // carry user_id NULL: nobody owns them, so they cannot be deleted from the
    // UI. Never set this on a deployed environment.
    const user = await resolveUser(req);
    if (!user && !DEV_NO_AUTH) {
      return res.status(401).json({ error: 'Avval tizimga kiring' });
    }
    const user_id = user?.id ?? null;
    const token = user?.token ?? null;

    // The real cap is per author, not per address. Keying this on the IP made
    // sense only while the IP was forgeable and the limit therefore toothless;
    // now that clientIp() returns the true peer, a per-IP cap of 5 would lock
    // out everyone sharing a carrier-grade NAT address. An unattributed dev
    // post has no author to key on, so it falls back to the address.
    const allowed = await checkRateLimit('post', user_id ? `user:${user_id}` : `ip:${clientIp(req)}`, 5, 600);
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
    const noteVal = str(note);
    const categoryOtherVal = str(category_other);
    const weightVal = str(weight);

    // Two types left, and both carry the same required fields. `announcement`
    // is rejected here like any other unknown value — an older cached bundle
    // whose note composer is still on screen gets a 400 rather than writing a
    // row the database would refuse anyway (posts_type_check).
    if (type !== 'traveler' && type !== 'request') {
      return res.status(400).json({ error: 'Noto\'g\'ri e\'lon turi' });
    }

    // A parcel ad is a transaction — it is useless without a way to reach its
    // author, so the contact is required.
    if (!contactVal) {
      return res.status(400).json({ error: 'Majburiy maydonlar to\'ldirilmagan' });
    }

    if (!fromCity || !toCity || !date || !weightVal) {
      return res.status(400).json({ error: 'Majburiy maydonlar to\'ldirilmagan' });
    }

    // Length caps — mirror the DB column widths and keep free-text fields sane
    // so a direct API caller can't store multi-MB blobs.
    const tooLong =
      fromCity.length > PARCEL_CITY_MAX ||
      toCity.length > PARCEL_CITY_MAX ||
      contactVal.length > 100 ||
      contact2Val.length > 100 ||
      noteVal.length > PARCEL_NOTE_MAX ||
      categoryOtherVal.length > PARCEL_CATEGORY_OTHER_MAX ||
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

    // Route countries. New clients send them; older cached clients send only
    // the legacy direction, from which we derive the codes. The route must be
    // between two different supported countries.
    let fromCountry = typeof from_country === 'string' ? from_country.toUpperCase() : null;
    let toCountry = typeof to_country === 'string' ? to_country.toUpperCase() : null;

    // A post's corridor is its route — one fact, one pair of columns. The
    // separate corridor_country the announcement shape needed is gone from the
    // table entirely, so anything a cached bundle still sends for it is
    // discarded here by never being read.
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
    // The "second handle with no first one" guard that used to sit here is
    // gone with the shape that made it reachable: a contact is required above,
    // so contactVal is non-empty by the time control gets this far.
    if (contact2Val && !isValidContact(contact2Val, contact2_type as ContactKind)) {
      return res.status(400).json({ error: 'Aloqa ma\'lumoti noto\'g\'ri' });
    }

    let dateValue: string;
    let expires_at: string;

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

    // Store the date the author picked.
    // Normalised through the parsed Date rather than passed through raw, so
    // what lands in the DATE column is the same YYYY-MM-DD shape whatever
    // the client sent. `new Date('YYYY-MM-DD')` parses as UTC midnight and
    // toISOString reads back in UTC, so this round-trips without a
    // timezone shift.
    dateValue = postDate.toISOString().split('T')[0];

    postDate.setDate(postDate.getDate() + 1);
    expires_at = postDate.toISOString().split('T')[0];

    // Clamp numerics to sane bounds so an out-of-range value can't overflow the
    // DB column (NUMERIC(6,2) / SMALLINT) and throw a 500.
    const clamp = (n: unknown, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, Number(n) || 0));
    const safeWeightKg = clamp(weight_kg, 0, 100);
    const safeLuggage = clamp(luggage_count, 0, 20);

    // One shape now, so one literal. `headline` is still written explicitly:
    // the column survives the announcement type (it holds the retired rows'
    // themes) and posts_shape_by_type_check requires it NULL on everything
    // written from here, so hard-coding it is what keeps a caller from
    // smuggling one in through PostgREST-shaped input.
    const row = {
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
    // Without a token this is the DEV_NO_AUTH path, which has to go around RLS
    // entirely — see the note above the 401.
    const db = token ? userScopedClient(token) : serviceClient();
    const { data, error } = await db
      .from('posts')
      .insert([row])
      // Only the id comes back: `authenticated` holds a column-level SELECT
      // grant on (id, user_id) and nothing more, so `.select()` with no
      // argument would now fail on the contact columns.
      .select('id')
      .single();

    if (error) {
      // The 23505 → 409 branch that used to sit here belonged to the
      // one_active_announcement trigger, which was the only thing on this table
      // that ever raised that code — `posts` has no unique constraint besides
      // the primary key. Both are gone.
      console.error('Error creating post:', { message: error.message, code: error.code });
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
      console.error('Error deleting post:', { message: error.message, code: error.code });
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }

    return res.status(200).json({ ok: true });
  } else {
    res.setHeader('Allow', 'GET, POST, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  }
}
