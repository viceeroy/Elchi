import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';
import { checkRateLimit, clientIp } from '../lib/rate-limit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.query.token;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Noto\'g\'ri so\'rov' });
  }

  const allowed = await checkRateLimit(`auth_status_${token}`, clientIp(req), 120, 600, false);
  if (!allowed) {
    return res.status(429).json({ error: 'Juda ko\'p urinish. Birozdan keyin urinib ko\'ring' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('signup_tokens')
    .select('status, hashed_token, expires_at')
    .eq('token', token)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Token topilmadi' });
  }

  if (new Date(data.expires_at) < new Date()) {
    return res.status(400).json({ status: 'expired', error: 'Token muddati o\'tgan' });
  }

  if (data.status === 'verified') {
    return res.status(200).json({ status: 'verified', hashed_token: data.hashed_token });
  }

  return res.status(200).json({ status: 'pending' });
}
