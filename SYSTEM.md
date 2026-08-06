# Elchi — System Architecture

Full structural reference. For day-to-day conventions see [CLAUDE.md](CLAUDE.md); for setup see
[README.md](README.md).

---

## 1. What the system does

Elchi is a bulletin board for the Korea ↔ Uzbekistan parcel corridor. Travelers advertise spare
luggage space; senders advertise parcels needing a ride. The board matches nobody and handles no money — it stores an ad and, to logged-in viewers,
reveals a contact handle. Everything after that happens off-platform.

Consequences that shape the whole design:

- **Contact handles are the only asset worth stealing.** Most of the security design exists to
  make bulk harvesting expensive.
- **Posts expire.** `expires_at` is a hard filter in the read model, not a cleanup job.
- **Anonymous reading, authenticated writing and revealing.** Browsing needs no account.

---

## 2. Stack

| Layer | Technology |
|---|---|
| UI | React 19, Vite 6, Tailwind v4 (`@tailwindcss/vite`), `motion`, `lucide-react` |
| API | Vercel Serverless Functions (Node, `@vercel/node`) |
| Data | Supabase — Postgres 15+, RLS, SECURITY DEFINER views/functions |
| Auth | Supabase Auth: Google OAuth + a custom Telegram bridge |
| Hosting | Vercel (`vercel.json` handles build, rewrites, security headers) |
| Analytics | `@vercel/analytics` |

TypeScript throughout, `noEmit` — Vite and Vercel own the actual builds.

---

## 3. Repository map

```
src/                    React SPA
  App.tsx               Feed, detail sheet, modal orchestration, auth session
  main.tsx              Root render + Analytics
  types.ts              Post, PostContact, Locale, Translations
  constants.ts          COUNTRIES registry, HOME_COUNTRY, hub-city helpers
  translations.ts       Uzbek dictionary
  index.css             Tailwind import + @theme design tokens
  supabaseClient.ts     Browser client (anon key, session persistence)
  components/           BoardingPass, FeedCard, PostFormModal, PostFab,
                        RouteSelector, ContactFields, LoginModal,
                        NameGateModal, ProfileSheet, FlagIcon
  notes/                Static editorial cards (data.ts, NoteCard, NotesCarousel, NoteSheet)
  lib/postPreview.ts    Sanitises free text for a card's clamped note line
  assets/               Logo SVGs

api/                    Vercel serverless functions
  posts.ts              GET list / GET one / GET contact / POST create / DELETE
  auth-telegram.ts      Telegram login → Supabase session bridge

lib/                    Shared server modules (some client-safe)
  supabase.ts           Anon-key server client
  supabase-admin.ts     Service-role client, lazily built, SERVER ONLY
  rate-limit.ts         Postgres-backed limiter + trustworthy client IP
  contact.ts            Handle validation + tel:/t.me link builders (shared)
  contact.test.ts       node:test unit tests

migrations/             Dated incremental SQL
supabase-schema.sql     Complete from-scratch schema
scripts/                generate-random-posts.ts (seed helper)
public/ dist/           Static assets / build output
```

---

## 4. Data model

### `posts` — one table, one shape, two sides

A single table holds both post types. They share every column; `type` says which side of the
trade the author is on, and a CHECK constraint keeps the columns coherent.

| Group | Columns |
|---|---|
| Identity | `id` UUID PK, `type` (`traveler`/`request`), `user_id` |
| Route | `from_country`, `to_country`, `from_city`, `to_city`, `direction` (legacy) |
| Trip | `date` (nullable — "negotiable") |
| Cargo | `weight_kg`, `luggage_count`, `categories[]`, `category_other`, `weight` (display cache) |
| Copy | `note` (free text), `headline` (retired — always NULL) |
| Contact | `contact`, `contact_type`, `contact2`, `contact2_type` |
| Lifecycle | `created_at`, `expires_at` |

**Countries are structured; cities are free text.** Only ISO alpha-2 country codes are
filterable. Cities are display-only strings the author typed.

**A post's corridor is its route.** `from_country`/`to_country` name it outright, which is why
there is no separate corridor column. There used to be: a third type, `announcement` (a standing
service ad), sat in *one* country, and a note sitting in Uzbekistan could belong to any corridor,
so `corridor_country` recorded which board it was filed under. Type and column were both removed
on 2026-08-07 — see [migrations/2026-08-07-remove-announcements.sql](migrations/2026-08-07-remove-announcements.sql).

**`posts_shape_by_type_check`** is a single predicate, no longer a `CASE` over the type: no
`headline`; both cities and `weight` required; both route countries set and different.

Declared `NOT VALID` — for legacy rows predating the constraint, and for the announcement rows
kept in the table. Those rows are never re-checked (`posts` has no UPDATE policy) and never
readable (`public_posts` filters them out), so they sit inert rather than being deleted.

### `public_posts` — the read model

A `security_invoker = false` view exposing every column the feed renders **minus** the contact
values and `user_id`, with `expires_at >= CURRENT_DATE` and `type <> 'announcement'` reproduced
inside it — the latter is what retires the kept announcement rows from every read path,
including the `?id=` deep link. `has_contact2` is
computed. Granted to `anon` and `authenticated`. This is the only route anonymous readers have
into post data.

It `LEFT JOIN`s `profiles` for the author's `display_name`, which is what card footers print.
The join rides on `security_invoker = false` — the view reads `profiles` as its owner, so that
table's own-row-only RLS doesn't block an anonymous reader — which means anything added to the
join is published. `display_name` is the only profiles column exposed.

### `profiles`

Created by an `on_auth_user_created` trigger. Holds `auth_provider` (`google` | `telegram`) and
`display_name`. Posts carry `user_id`, which is never exposed; the only thing that crosses from a
profile onto a card is `display_name`, so the board stays pseudonymous.

`display_name` is nullable, seeded from provider metadata through `normalize_display_name()`, and
bounded by `profiles_display_name_check` (2–40 chars, no outer whitespace). When it is NULL the
client shows a blocking capture sheet after login (`NameGateModal`) and writes the answer straight
to `profiles` under the own-row UPDATE policy — the API is not in that path, which is why the CHECK
is the real enforcement. There is no edit UI: capture-once.

### `rate_limits`

Fixed-window counters. RLS on, no anon policies; written only by `check_rate_limit()`.

---

## 5. Security model

The anon key ships inside the browser bundle, so **every guarantee must hold against a caller
who talks to PostgREST directly**, bypassing `api/` entirely.

**Table access.** `SELECT` is revoked from `anon` and `authenticated` on `posts`. Authenticated
users get a column-level grant on `(id, user_id)` only — enough for `DELETE ... WHERE id = ? AND
user_id = ?`, for the `.select('id')` after an insert, and for the profile post count. Not
enough to read a contact.

**Policies.** SELECT scoped to authenticated + unexpired (governing only the granted columns).
INSERT requires `user_id = auth.uid()`. DELETE requires ownership. **No UPDATE policy** — posts
are immutable once written.

**Contact reveal.** `get_post_contact(p_id)` is SECURITY DEFINER with a pinned `search_path`,
raises on `auth.uid() IS NULL`, returns exactly one post's handles, and is granted only to
`authenticated` and `service_role`. One post per call makes harvesting linear and rate-limitable
per user.

**Rate limiting** ([lib/rate-limit.ts](lib/rate-limit.ts)) runs through the SECURITY DEFINER
`check_rate_limit()` so it works with the anon key. It **fails open** — a DB hiccup must not
lock the board. Client IP prefers `x-vercel-forwarded-for`, then `x-real-ip`, then the
*right-most* `x-forwarded-for` hop; the left-most entry is attacker-controlled and reading it
previously made every limit defeatable with one header.

Current buckets (max / window seconds):

| Bucket | Key | Limit |
|---|---|---|
| `read` | IP | 600 / 600 |
| `contact` | user | 60 / 600 |
| `contact-ip` | IP | 240 / 600 |
| `post-ip` | IP | 40 / 600 |
| `post` | user (or IP) | 5 / 600 |
| `delete` | user | 30 / 600 |
| `auth` | IP | 60 / 600 |

**Transport.** [vercel.json](vercel.json) sets a strict CSP (self + telegram.org + the Supabase
project + Vercel insights), `X-Frame-Options: DENY`, HSTS, `Permissions-Policy` denying
geolocation/mic/camera/payment/USB, and `Cache-Control: private, no-store` on every API
response — post data is personal and must never sit in an intermediary cache.

---

## 6. API surface

Two functions. `/api/posts` multiplexes on method and query.

### `GET /api/posts`

| Query | Behavior |
|---|---|
| — | Paged feed from `public_posts` |
| `?type=…` | **Ignored.** One kind of post is left, so there is nothing to narrow to. Deliberately ignored rather than rejected: a cached bundle still sends `parcel`/`announcement`/`all`, and a 400 would turn its old notes tab into an error instead of a feed |
| `?country=XX` | Corridor filter (the far country; UZ is implied) |
| `?id=<uuid>` | One post — used for deep links, resolved against the API because a shared post may sit past page one |
| `?id=<uuid>&fields=contact` | Contact handles. **401 unless authenticated** |

Page size defaults to 24, caps at 100. A bearer token, when present, adds `is_mine` to each row
via a separate ownership query — `user_id` itself never reaches the client.

### `POST /api/posts`

Requires a bearer token; inserts through a **user-scoped client** so RLS sees the author's
`auth.uid()`. Validates type, route countries, categories, date format and range, field lengths,
spam heuristics, and both contact handles against their declared channel (not by sniffing a
leading `@`, so the stored type and value can't disagree). Returns `201 {id}`.

### `DELETE /api/posts?id=<uuid>`

Author only, enforced by RLS.

### `POST /api/auth-telegram`

Verifies Telegram's HMAC over the login payload with the bot token, enforces a **two-sided**
`auth_date` window (±300s — the one-sided version accepted timestamps years in the future), then
uses the service-role admin API to create-or-reuse a synthetic user
(`telegram_<id>@elchi.local`) and returns a `hashed_token` the client exchanges for a Supabase
session. Repeat logins legitimately collide on the synthetic email and are detected by status
`422` / code `email_exists` before falling back to message text.

Wrapped in an outer try/catch so an unexpected throw returns clean JSON instead of Vercel's raw
`FUNCTION_INVOCATION_FAILED` HTML, which breaks `res.json()` on the client. The admin client is
built lazily for the same reason.

---

## 7. Frontend

### Composition

`App.tsx` is one component holding all page state: the post list and paging, the corridor
filter (`country`, default `KR`), the composer sheet and its initial tab, the selected post and
its lazily-revealed contact, the auth session, and the toast. Children are presentational.

The `parcel | notes` feed chips are gone with the announcement board — one kind of post means
nothing to select between, and a lone always-active chip is a label pretending to be a control.

### Rendering path

`RouteSelector` picks the corridor → the feed fetches `/api/posts?country=…` → each row renders
as `BoardingPass`, whose chrome (silhouette, airmail stripe, badge row, footer) comes from
`FeedCard`. Tapping a card opens the detail sheet; tapping *Bog'lanish* fetches the contact and
renders `t.me` / `tel:` links built by [lib/contact.ts](lib/contact.ts).

`PostFab` is a speed dial with two arms, both opening `PostFormModal` (traveler / request, two
tabs, per-field inline validation) on the chosen side.

`NotesCarousel` sits above the feed with static editorial cards from
[src/notes/data.ts](src/notes/data.ts). These are **not** posts: no API, no DB, not filtered.
Dismissals persist in `localStorage`.

### Design tokens

[src/index.css](src/index.css) `@theme` defines the entire visual language: `paper`, `card`,
`ink`, `blue`, `red`, `gold`, `gold-lit`, `edge`, `rule`, `body`, `faint`, `field`, plus
`--shadow-card` / `--shadow-card-hover`. Blue marks travelers, red marks requests; gold is the
board's accent (the contact button, the disclaimer rule). Fonts: Inter Tight (sans), Space Mono (mono, used for stub/tag microcopy).

### i18n

`Locale` is a one-arm union (`"uz"`). `Translations` and `COUNTRIES.names` keep their per-locale
record shape so a second language is purely additive. `t.months` is non-optional — it's the
single source for every rendered date.

---

## 8. Auth flow

1. `LoginModal` offers Telegram (widget) or Google (Supabase OAuth). Email login is disabled.
2. Telegram: widget payload → `POST /api/auth-telegram` → `hashed_token` → client verifies OTP →
   Supabase session.
3. Google: standard Supabase OAuth redirect; `App.tsx` strips the leftover `#access_token` hash
   from the URL bar on `onAuthStateChange`.
4. Session drives three gates: posting, deleting, and revealing a contact.

All three gates are enforced twice: in `api/posts.ts` (401 without a verified bearer token) and
again in Postgres (the RLS insert/delete policies and `get_post_contact`'s `auth.uid()` check).
The client gates — the composer, the delete button, the contact panel — are UX only; none of
them is the security boundary, and there is no flag that turns any of them off.

Losing the session closes the composer and the profile sheet, and drops any revealed contact
from state, so an expired token never leaves an authenticated-only surface on screen.

---

## 9. Environments and deployment

| Variable | Side | Purpose |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | server | API's Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Telegram bridge only |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | client | Browser client |
| `TELEGRAM_BOT_TOKEN` | server | HMAC verification |
| `VITE_TELEGRAM_BOT_USERNAME` | client | Login widget |
| `ELCHI_API_PROXY` | dev | Overrides the Vite `/api` proxy target |
| `ELCHI_DEV_NO_AUTH` | dev | Relaxes the post auth gate. Ignored when `VERCEL_ENV`/`NODE_ENV` is `production` |

Vercel builds with `npm run build` → `dist`, rewrites `/api/*` to the functions and everything
else to `index.html` (SPA fallback). Schema changes apply as a dated file in `migrations/`,
mirrored into `supabase-schema.sql` for from-scratch installs.

---

## 10. Extension points

**A new corridor.** Uncomment the country in `COUNTRIES`
([src/constants.ts](src/constants.ts)) and add its code to `ALLOWED_COUNTRIES`
([api/posts.ts](api/posts.ts)). KZ, TJ, KG, TM are written and verified. No schema change —
country codes are validated by regex, not enumeration.

**A new locale.** Add the arm to `Locale`, fill `translations`, fill `names`/`cityNames` in
`COUNTRIES`, and reintroduce a switcher. The per-locale shapes already exist everywhere.

**A new post type.** Widen `posts_type_check`, turn `posts_shape_by_type_check` back into a
`CASE` over the type, extend `PostType`, reintroduce a `?type=` filter in
[api/posts.ts](api/posts.ts), and add a card component. The shape constraint is the contract —
start there, not in the API.
[migrations/2026-08-07-remove-announcements.sql](migrations/2026-08-07-remove-announcements.sql)
is the reverse of that walk, and worth reading first: the third type also needed a feed chip, a
per-author cap trigger, and a corridor column, none of which the schema hints at.

**Images (planned).** A commented `image_url` column stub sits in the schema.
