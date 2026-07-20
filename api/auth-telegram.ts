import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase-admin.js';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
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

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - payload.auth_date > AUTH_DATE_MAX_AGE_SECONDS) {
    return res.status(401).json({ error: 'Sessiya muddati o\'tgan' });
  }

  if (!verifyTelegramHash(payload, botToken)) {
    return res.status(401).json({ error: 'Tasdiqlash muvaffaqiyatsiz' });
  }

  const syntheticEmail = `telegram_${payload.id}@elchi.local`;

  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: syntheticEmail,
    email_confirm: true,
    user_metadata: {
      telegram_id: payload.id,
      telegram_username: payload.username || null,
      display_name: payload.first_name || payload.username || null,
      avatar_url: payload.photo_url || null,
      provider: 'telegram',
    },
  });

  // Idempotent: repeat logins from the same Telegram account hit the same
  // synthetic email and legitimately fail with "already registered".
  if (createError && !createError.message?.toLowerCase().includes('already')) {
    console.error('Error creating Telegram user:', createError);
    return res.status(500).json({ error: 'Xatolik yuz berdi' });
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: syntheticEmail,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('Error generating Telegram session link:', linkError);
    return res.status(500).json({ error: 'Xatolik yuz berdi' });
  }

  return res.status(200).json({ hashed_token: linkData.properties.hashed_token });
}
