import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';
import { checkRateLimit, clientIp } from '../lib/rate-limit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const allowed = await checkRateLimit('auth', clientIp(req), 60, 600, false);
  if (!allowed) {
    return res.status(429).json({ error: 'Juda ko\'p urinish. Birozdan keyin urinib ko\'ring' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  const { data, error } = await supabaseAdmin
    .from('signup_tokens')
    .insert({ expires_at: expiresAt })
    .select('token')
    .single();

  if (error || !data) {
    console.error('Error creating signup token:', error);
    return res.status(500).json({ error: 'Xatolik yuz berdi' });
  }

  return res.status(200).json({ token: data.token });
}
