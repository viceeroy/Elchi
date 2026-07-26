// Vercel project configuration. This replaces vercel.json (only one of the two
// may exist) because the Content-Security-Policy has to differ between the
// deployed site and `vercel dev`, and a static file can't express that.
//
// Why the split: `vercel dev` applies these headers to the pages Vite serves,
// and Vite's dev server injects the React Fast Refresh preamble as an INLINE
// script. The production policy has no 'unsafe-inline' in script-src, so the
// preamble is blocked and the app fails to mount with "@vitejs/plugin-react
// can't detect preamble". The built bundle has no preamble, so production never
// needed the relaxation.
//
// The choice is made here, when the config is evaluated, from an environment
// variable — not from a per-request condition. A `has`/`missing` host rule in
// vercel.json would have been the smaller change, but it keys off request
// state, so the relaxed policy would sit one request header away from the real
// site. It also simply does not work: `vercel dev` matches no `host` condition
// at all, so the split had no effect in the one case it exists for.

const SHARED_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "frame-src https://oauth.telegram.org",
];

const SUPABASE_ORIGIN = 'https://twxvbbwhjdjnwbxakopv.supabase.co';

const PRODUCTION_CSP = [
  ...SHARED_CSP,
  "script-src 'self' 'unsafe-eval' https://telegram.org https://va.vercel-scripts.com",
  `connect-src 'self' ${SUPABASE_ORIGIN} https://vitals.vercel-insights.com`,
  'upgrade-insecure-requests',
].join('; ');

// Local-only. Adds 'unsafe-inline' for the Fast Refresh preamble and the
// localhost websocket for HMR, and drops upgrade-insecure-requests so plain
// http://localhost isn't rewritten to https.
const DEVELOPMENT_CSP = [
  ...SHARED_CSP,
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://telegram.org https://va.vercel-scripts.com",
  `connect-src 'self' ws://localhost:* http://localhost:* ${SUPABASE_ORIGIN} https://vitals.vercel-insights.com`,
].join('; ');

// Fail closed. The relaxed policy requires an explicit opt-in that only the
// local dev script sets (`npm run dev:api`); every other way this file is
// evaluated — a Vercel build, a bare `vercel dev`, CI — gets the production
// policy. Deliberately NOT keyed off VERCEL_ENV: `vercel dev` exposes no
// VERCEL_* variables here at all, so "unset means local" would have meant a
// build that somehow lost VERCEL_ENV shipping 'unsafe-inline' to the real site.
const csp = process.env.ELCHI_DEV_CSP === '1' ? DEVELOPMENT_CSP : PRODUCTION_CSP;

export const config = {
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    { source: '/api/(.*)', destination: '/api/$1' },
    // Everything else falls through to the SPA shell. The exclusions are the
    // paths that must be served as real files: the API, the module graph Vite
    // serves in dev (src/, lib/, @vite/, …) and the built assets.
    {
      source: '/((?!api/|src/|lib/|@vite/|@react-refresh|node_modules/|assets/|favicon.ico).*)',
      destination: '/index.html',
    },
  ],
  headers: [
    {
      source: '/api/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'private, no-store' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    },
    {
      source: '/((?!api/).*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      ],
    },
  ],
};
