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
//
// `failOpen` controls what happens on a transient DB error:
//   true  — allow the request (default; prefer availability over protection)
//   false — deny the request (prefer protection over availability)
// Sensitive buckets (contact reveal, auth) use failOpen = false so a DB hiccup
// does not silently remove the one gate that prevents bulk scraping.
export async function checkRateLimit(
  bucket: string,
  identifier: string,
  max: number,
  windowSec: number,
  failOpen = true,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_bucket: bucket,
      p_identifier: identifier,
      p_max: max,
      p_window_sec: windowSec,
    });

    if (error) {
      console.error('Rate limit check failed:', { message: error.message, code: error.code });
      return failOpen;
    }

    // The function returns a boolean: true = allowed, false = limited.
    return data !== false;
  } catch (err) {
    console.error('Rate limit check threw:', err instanceof Error ? err.message : err);
    return failOpen;
  }
}

// Client IP from Vercel's proxy headers.
//
// The left-most entry of x-forwarded-for is NOT trustworthy: it is whatever the
// client sent, and the proxy appends the real address to the right. Reading it
// let anyone defeat every limit here with `-H "X-Forwarded-For: <random>"`,
// since each forged value opened a fresh bucket.
//
// Order of preference:
//   1. x-vercel-forwarded-for — set by Vercel's edge, not forwardable by the
//      client, so it is the real peer address.
//   2. x-real-ip — likewise set by the platform.
//   3. the RIGHT-most x-forwarded-for entry — the hop our proxy actually saw.
//      Still the last resort, but not attacker-chosen.
export function clientIp(req: VercelRequest): string {
  const first = (v: string | string[] | undefined): string | null => {
    const raw = Array.isArray(v) ? v[0] : v;
    return raw && raw.trim() ? raw.trim() : null;
  };

  const vercelIp = first(req.headers['x-vercel-forwarded-for']);
  if (vercelIp) return vercelIp;

  const realIp = first(req.headers['x-real-ip']);
  if (realIp) return realIp;

  const fwd = first(req.headers['x-forwarded-for']);
  if (fwd) {
    const hops = fwd.split(',').map((h) => h.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }

  return 'unknown';
}
