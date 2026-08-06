import { supabase } from './supabase.js';

// Verified-token memo for the API's auth check.
//
// Every authenticated route resolved its caller by calling GoTrue's
// `auth.getUser(token)`, which is a full network round trip to the auth server.
// It ran on the feed list, the single-post read, the contact reveal, the insert
// and the delete — so the cheapest request on the board (an indexed select of
// one page) still paid for two hops before it could answer. A warm serverless
// instance handles many requests in a row from the same few browsers, and those
// requests carry the *same* access token for the hour it is valid, so all but
// the first of them can be answered from memory.
//
// Why memoising an auth check is not a security regression here. A Supabase
// access token is a signed JWT with an `exp` about an hour out, and
// `auth.getUser()` verifies exactly two things: the signature, and that expiry.
// It does not consult a revocation list — signing out does not invalidate an
// already-issued access token server-side, it only stops the refresh that would
// mint the next one. So a token this cache still honours is a token GoTrue
// would also still honour. The TTL below is a minute, far inside the window the
// platform was granting anyway.
//
// Only SUCCESSFUL verifications are stored. A failure is as likely to be a
// transient network error as a forged token, and caching one would lock a real
// user out for the whole TTL while caching the other buys nothing — a bad token
// is rejected on arrival either way.

// How long a verified token may be served from memory. Short enough that the
// gap between a token being disowned upstream and this cache noticing stays
// negligible; long enough to cover a burst of requests from one open tab (the
// feed, its ownership query, a reveal, a delete).
const TTL_MS = 60_000;

// Hard cap on retained entries, so a stream of distinct tokens cannot grow the
// map without bound on a long-lived instance. Map preserves insertion order, so
// the oldest key is the first one iteration yields.
const MAX_ENTRIES = 500;

interface Entry {
  id: string;
  /** Wall-clock ms after which this entry must be re-verified upstream. */
  expiresAt: number;
}

const cache = new Map<string, Entry>();

// The `exp` claim, in ms, or null when the token is not a readable JWT.
//
// This is used ONLY to reject — an expired token is turned away without a round
// trip, and an unreadable one falls through to GoTrue unchanged. It never
// admits anyone: a forged token with a distant `exp` still has to survive the
// signature check upstream, because nothing here ever returns a user id that
// GoTrue did not hand over first.
function jwtExpiryMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Resolves an access token to its user id, or null when the token is absent,
 * malformed, expired or rejected upstream. Never throws — an unauthenticated
 * request is a normal case on this API, not an error.
 */
export async function verifyAccessToken(token: string): Promise<string | null> {
  if (!token) return null;

  const now = Date.now();
  const exp = jwtExpiryMs(token);
  if (exp !== null && exp <= now) return null;

  const hit = cache.get(token);
  if (hit) {
    if (hit.expiresAt > now) return hit.id;
    // Stale. Drop it now so the re-insert below lands at the end of the
    // insertion order rather than keeping this key's original position and
    // making it a premature eviction candidate.
    cache.delete(token);
  }

  const { data, error } = await supabase.auth.getUser(token);
  const id = error ? null : data.user?.id ?? null;
  if (!id) return null;

  // Never outlive the token itself: a session that expires in ten seconds must
  // not be served for a minute because this cache rounded up.
  const until = exp === null ? now + TTL_MS : Math.min(now + TTL_MS, exp);
  cache.set(token, { id, expiresAt: until });

  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }

  return id;
}
