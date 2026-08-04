# CLAUDE.md

Working guide for agents in this repo. Architecture detail lives in [SYSTEM.md](SYSTEM.md);
user-facing setup lives in [README.md](README.md). This file is conventions and gotchas.

## What Elchi is

A free bulletin board pairing travelers (spare luggage space) with senders (parcels) on the
Korea ↔ Uzbekistan corridor. No payments, no escrow, no messaging — the board hands over a
contact handle and gets out of the way.

Three post types: `traveler` (I'm flying, I have space), `request` (I have a parcel),
`announcement` (a standing service ad — cargo company, agency).

## Commands

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run lint
```

```bash
npm test
```

`lint` is `tsc --noEmit` — there is no ESLint. `test` is `node --test "lib/**/*.test.ts"`;
only `lib/` is covered (currently [lib/contact.test.ts](lib/contact.test.ts)).

`vite` serves the SPA but **not** `api/` — those are Vercel functions. For a working feed
locally, run `vercel dev` alongside; [vite.config.ts](vite.config.ts) proxies `/api` to
`http://localhost:3000` (override with `ELCHI_API_PROXY`).

## Layout

| Path | What |
|---|---|
| [src/App.tsx](src/App.tsx) | The whole page — feed, detail sheet, modals wiring. ~1000 lines, single component |
| [src/components/](src/components) | Cards, composers, selectors, auth sheets |
| [src/notes/](src/notes) | Static editorial cards above the feed. **Not** posts, never touch the API |
| [src/types.ts](src/types.ts) | `Post`, `PostContact`, `Translations`, `Locale` |
| [src/constants.ts](src/constants.ts) | Country registry — the source of truth for supported routes |
| [src/translations.ts](src/translations.ts) | Uzbek copy, keyed by `Locale` |
| [api/](api) | Vercel serverless: `posts.ts` (CRUD), `auth-telegram.ts` (login bridge) |
| [lib/](lib) | Shared server code: supabase clients, rate limiter, contact validation |
| [supabase-schema.sql](supabase-schema.sql) | Full schema, RLS, views, functions, triggers |
| [migrations/](migrations) | Dated incremental SQL, applied on top of a live DB |

`lib/` is imported by both `api/` and `src/` — [lib/contact.ts](lib/contact.ts) is the one
module that legitimately crosses the boundary. [lib/supabase-admin.ts](lib/supabase-admin.ts)
is service-role and **must never** be imported into `src/`.

## Rules that bite

**Contact values never travel in a list response.** The feed reads the `public_posts` view,
which omits `contact`/`contact2` and `user_id`. Handles come one post at a time from
`get_post_contact()`, authenticated only. Don't "optimize" by adding them to `PUBLIC_COLUMNS`.

**The API is not the only writer.** `authenticated` can INSERT through PostgREST with the
bundled anon key, and cached bundles outlive a deploy. Every invariant that matters must be
enforced in SQL (`posts_shape_by_type_check`, the announcement triggers) — a check in
[api/posts.ts](api/posts.ts) alone is advisory.

**Validation is duplicated on purpose.** [lib/contact.ts](lib/contact.ts) runs on both sides;
the server copy is the security boundary, the client copy is inline feedback. Change both, or
change neither.

**Adding a country is two edits, not one.** `COUNTRIES` in [src/constants.ts](src/constants.ts)
*and* `ALLOWED_COUNTRIES` in [api/posts.ts](api/posts.ts). KZ/TJ/KG/TM are pre-written and
commented out. No schema change needed.

**Colors and shadows are tokens.** [src/index.css](src/index.css) `@theme` holds twelve colors
and two card shadows. No hex literals in components; no inline `style={{ boxShadow }}` — an
inline shadow silently beats the Tailwind hover class next to it.

**Uzbek only.** `Locale` is a union of one (`"uz"`). The per-locale shape in `Translations` and
`COUNTRIES.names` is kept so a second locale is an additive change. Never hardcode Uzbek
strings in a component — `t.months` exists precisely because three components had copies.

**Errors are user-facing Uzbek.** API error strings go straight to the user. Keep new ones in
Uzbek and generic (`'Xatolik yuz berdi'`) — don't leak DB detail.

**The auth gate has no client-side switch.** Posting, deleting and revealing a contact all
require a session, and the client gate must match the server's. `REQUIRE_LOGIN_TO_POST` in
`App.tsx` used to turn the composer gate off; it is gone. Don't reintroduce one — a composer
that opens without a session just walks the author into a 401 on submit.

**Dev-only flag.** `ELCHI_DEV_NO_AUTH` in [api/posts.ts](api/posts.ts) relaxes the post auth
gate. It self-disables when `VERCEL_ENV`/`NODE_ENV` is `production`, and still needs the
service-role key to do anything, because RLS demands a real `auth.uid()`.

## Style

- Comments explain *why*, at length, where a decision is non-obvious or was previously wrong.
  Match that density — this codebase documents its own trade-offs and reversals.
- Components: `React.FC<Props>` with a local `interface XProps`, named export.
- Tailwind v4 utilities inline; token names (`text-ink`, `bg-paper`, `shadow-card`) over values.
- Server imports use the `.js` extension (`from './supabase.js'`) — required by the Vercel
  Node ESM build. Client imports do not.
- `@/*` resolves to the repo root in both Vite and tsc.

## Before you commit

Run `npm run lint` and `npm test`. Schema changes need a dated file in
[migrations/](migrations) **and** the corresponding edit folded into
[supabase-schema.sql](supabase-schema.sql), which is the from-scratch install.
