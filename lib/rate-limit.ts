import type { VercelRequest } from '@vercel/node';
import { supabaseAdmin } from './supabase-admin.js';

// Postgres-backed fixed-window rate limiter. Serverless functions don't share
// memory between invocations, so the counter lives in the `rate_limits` table
// and is read/written with the service-role client (the table has no anon RLS
// policy — only this server code can touch it).
//
// Returns true when the request is allowed, false when the limit is exceeded.
// Fails open: if the store errors we let the request through rather than lock
// everyone out on a transient DB hiccup.
export async function checkRateLimit(
  bucket: string,
  identifier: string,
  max: number,
  windowSec: number,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowSec * 1000).toISOString();

  try {
    // Drop rows that have aged out of the window for this key so the table
    // doesn't grow unbounded and the count below only sees live hits.
    await supabaseAdmin
      .from('rate_limits')
      .delete()
      .eq('bucket', bucket)
      .eq('identifier', identifier)
      .lt('created_at', windowStart);

    const { count, error: countError } = await supabaseAdmin
      .from('rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('bucket', bucket)
      .eq('identifier', identifier)
      .gte('created_at', windowStart);

    if (countError) {
      console.error('Rate limit count failed, allowing request:', countError);
      return true;
    }

    if ((count ?? 0) >= max) return false;

    const { error: insertError } = await supabaseAdmin
      .from('rate_limits')
      .insert([{ bucket, identifier }]);

    if (insertError) {
      console.error('Rate limit insert failed, allowing request:', insertError);
      return true;
    }

    return true;
  } catch (err) {
    console.error('Rate limit check threw, allowing request:', err);
    return true;
  }
}

// Best-effort client IP from Vercel's proxy headers. x-forwarded-for is a
// comma-separated chain; the left-most entry is the original client.
export function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  if (raw) return raw.split(',')[0].trim();
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real) return real;
  return 'unknown';
}
