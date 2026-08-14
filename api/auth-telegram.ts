import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';
import { checkRateLimit, clientIp } from '../lib/rate-limit.js';

interface TelegramAuthPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const AUTH_DATE_MAX_AGE_SECONDS = 300;

// Verifies the Telegram Login Widget payload per Telegram's documented HMAC
// scheme: https://core.telegram.org/widgets/login#checking-authorization
function verifyTelegramHash(payload: TelegramAuthPayload, botToken: string): boolean {
  const { hash, ...fields } = payload;
  if (!hash) return false;

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${(fields as Record<string, unknown>)[key]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const received = Buffer.from(hash, 'hex');
  const computed = Buffer.from(computedHash, 'hex');
  if (received.length !== computed.length) return false;
  return crypto.timingSafeEqual(received, computed);
}

async function handleTelegramAuth(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Reject oversized bodies before any work. A legitimate Telegram auth
  // payload is ~200 bytes; this stops multi-KB garbage from being parsed.
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 2_000) {
    return res.status(413).json({ error: 'So\'rov juda katta' });
  }

  // Throttle auth attempts per IP to slow abuse of the bridge. Forging the
  // payload is not the threat this stops — the HMAC below makes that
  // infeasible — so the cap is sized against hammering Supabase's admin API,
  // and left loose enough that a shared carrier-grade NAT address (common in
  // both corridors) doesn't lock out real users. It only became a real limit
  // at all once clientIp() stopped trusting a client-supplied header.
  //
  // Fails closed: if the rate-limit DB is unreachable, denying auth is better
  // than allowing unlimited session creation against Supabase admin API.
  const allowed = await checkRateLimit('auth', clientIp(req), 60, 600, false);
  if (!allowed) {
    return res.status(429).json({ error: 'Juda ko\'p urinish. Birozdan keyin urinib ko\'ring' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN is not configured');
    return res.status(500).json({ error: 'Xatolik yuz berdi' });
  }

  const payload = req.body as TelegramAuthPayload;
  if (!payload || !payload.id || !payload.auth_date || !payload.hash) {
    return res.status(400).json({ error: 'Noto\'g\'ri so\'rov' });
  }

  // Two-sided window. The one-sided check accepted any auth_date in the future,
  // so a payload timestamped years ahead would never expire. The HMAC covers
  // auth_date, so forging one isn't practical — but the bound should not depend
  // on that being true, and a small allowance absorbs clock skew.
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - payload.auth_date) > AUTH_DATE_MAX_AGE_SECONDS) {
    return res.status(401).json({ error: 'Sessiya muddati o\'tgan' });
  }

  if (!verifyTelegramHash(payload, botToken)) {
    return res.status(401).json({ error: 'Tasdiqlash muvaffaqiyatsiz' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const syntheticEmail = `telegram_${payload.id}@elchi.local`;

  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: syntheticEmail,
    email_confirm: true,
    user_metadata: {
      telegram_id: payload.id,
      telegram_username: payload.username || null,
      // Recorded, but it does NOT become the profile's display_name — that
      // column is the user's own answer to the capture gate and nothing else.
      // handle_new_user() ignores this field on purpose; see
      // migrations/2026-08-06-display-name-user-entered.sql.
      display_name: payload.first_name || payload.username || null,
      avatar_url: payload.photo_url || null,
      provider: 'telegram',
    },
  });

  // Idempotent: repeat logins from the same Telegram account hit the same
  // synthetic email and legitimately fail as "already registered". Detect that
  // via Supabase's status/code first (422 / email_exists) and only fall back to
  // the message text, so a reworded message doesn't 500 every returning user.
  if (createError) {
    const err = createError as { status?: number; code?: string; message?: string };
    const isAlreadyExists =
      err.status === 422 ||
      err.code === 'email_exists' ||
      Boolean(err.message?.toLowerCase().includes('already'));
    if (!isAlreadyExists) {
      console.error('Error creating Telegram user:', { message: (createError as { message?: string }).message });
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: syntheticEmail,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('Error generating Telegram session link:', { message: linkError?.message });
    return res.status(500).json({ error: 'Xatolik yuz berdi' });
  }

  return res.status(200).json({ hashed_token: linkData.properties.hashed_token });
}

// Outer guard so any unexpected throw (e.g. a missing service-role key or a
// Supabase admin API failure) returns clean JSON the client can parse, instead
// of Vercel's raw "FUNCTION_INVOCATION_FAILED" HTML that breaks res.json().
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleTelegramAuth(req, res);
  } catch (err) {
    console.error('Unhandled error in auth-telegram:', err instanceof Error ? err.message : err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }
  }
}
