import type { VercelRequest } from '@vercel/node';
import { supabase } from './supabase.js';

// Postgres-backed fixed-window rate limiter. Serverless functions don't share
// memory between invocations, so the counter lives in the `rate_limits` table.
//
// The window logic runs inside a SECURITY DEFINER SQL function (check_rate_limit),
// so it works with the public anon key — no service-role key required — while the
// table itself stays locked (RLS on, no anon policies; only the function writes it).
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
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_bucket: bucket,
      p_identifier: identifier,
      p_max: max,
      p_window_sec: windowSec,
    });

    if (error) {
      console.error('Rate limit check failed, allowing request:', error);
      return true;
    }

    // The function returns a boolean: true = allowed, false = limited.
    return data !== false;
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
