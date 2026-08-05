// The browser client, assembled from the two Supabase sub-packages this app
// actually uses instead of the `createClient` umbrella.
//
// `createClient` constructs realtime, storage and functions clients eagerly
// whether or not you touch them, so none of them can be tree-shaken. This app
// touches none: there is no messaging, no uploads and no edge functions — only
// auth and one RLS-scoped count. Those three subsystems, plus storage-js's own
// transitive dependency on an Apache Iceberg REST catalog client, were 86 kB of
// the entry chunk, about a fifth of it, downloaded by every visitor to a
// noticeboard that never opens a websocket.
//
// What follows reproduces exactly what SupabaseClient does for auth and
// PostgREST and nothing else. Two details are load-bearing and were copied
// deliberately rather than invented:
//
//   * `storageKey`. SupabaseClient derives `sb-<first URL label>-auth-token`
//     from the project URL. auth-js's own default is the unrelated constant
//     `supabase.auth.token`, so letting it default would not merely be untidy —
//     every already-logged-in visitor would come back to a session the client
//     no longer looks for, and be silently signed out. The derivation is
//     duplicated here so the key stays byte-identical.
//
//   * The per-request Authorization header. SupabaseClient wraps fetch and
//     resolves the *current* access token on every call, falling back to the
//     anon key when there is no session. A header fixed at construction time
//     would pin the anon role forever, and `auth.uid()` would be null in
//     Postgres — the profile's post count would silently read 0 rather than
//     fail loudly. This must stay a per-request lookup.
//
// The realtime token plumbing in SupabaseClient (`_handleTokenChanged`) is not
// reproduced because its only job is `realtime.setAuth`, and there is no
// realtime client. Its auth wrapper class is a pass-through with no added
// behaviour. Nothing else in SupabaseClient touches auth or PostgREST.
//
// The two packages are pinned to the exact version `@supabase/supabase-js`
// depends on, which pins its own sub-packages exactly. They must be bumped
// together with it or npm will install a second, divergent copy.
import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const baseUrl = new URL(supabaseUrl);

export const auth = new AuthClient({
  url: new URL('auth/v1', baseUrl).href,
  // The anon key travels as both headers, exactly as the umbrella sends it.
  headers: {
    Authorization: `Bearer ${supabaseAnonKey}`,
    apikey: supabaseAnonKey,
  },
  storageKey: `sb-${baseUrl.hostname.split('.')[0]}-auth-token`,
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  // Explicit rather than defaulted: the OAuth redirect in LoginModal and the
  // Telegram verifyOtp bridge both depend on which flow is in play, and this is
  // the flow the app has always run. Defaults are free to change; this is not.
  flowType: 'implicit',
});

// Resolves the session per request — see the note above on why this cannot be
// hoisted into a static header.
const authedFetch: typeof fetch = async (input, init) => {
  const { data } = await auth.getSession();
  const headers = new Headers(init?.headers);
  if (!headers.has('apikey')) headers.set('apikey', supabaseAnonKey);
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${data.session?.access_token ?? supabaseAnonKey}`);
  }
  return fetch(input, { ...init, headers });
};

const rest = new PostgrestClient(new URL('rest/v1', baseUrl).href, {
  schema: 'public',
  fetch: authedFetch,
});

// Kept to the shape the call sites already use (`supabaseBrowser.auth.*`,
// `supabaseBrowser.from(...)`) so this swap is invisible above it. `from` is the
// only PostgREST verb the client needs; anything else — rpc, storage, channels —
// is deliberately absent rather than forwarded, so reaching for one is a
// compile error here rather than a silently reintroduced 86 kB.
export const supabaseBrowser = {
  auth,
  from: rest.from.bind(rest),
};
