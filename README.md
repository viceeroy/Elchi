# Elchi 🇰🇷 🇷🇺 ↔ 🇺🇿

Free bulletin board connecting travelers and senders for parcel delivery on the Korea ↔ Uzbekistan and Russia ↔ Uzbekistan corridors.

Travelers post available luggage space; senders post parcels needing a ride. No payments, no escrow — the board simply facilitates a direct contact exchange. Browsing the feed is open to all; authentication is required to publish a post, delete a post, or reveal contact handles.

## Stack

- **Frontend:** React 19 + Vite 6 + Tailwind v4
- **Backend:** Vercel Serverless Functions (`api/`)
- **Database:** Supabase (Postgres + RLS)
- **Auth:** Supabase Auth via Telegram bot confirmation flow (Google OAuth removed from UI; 4 legacy Google identities remain in DB)
- **i18n:** Uzbek only (`Locale = "uz"`, `src/translations.ts`)

## Corridors

Elchi operates across two active corridors (implied home country: Uzbekistan `UZ`):
- **Korea ↔ Uzbekistan** (`KR` ↔ `UZ`)
- **Russia ↔ Uzbekistan** (`RU` ↔ `UZ`)

Additional corridors (`KZ`, `TJ`, `KG`, `TM`) are prepared in `src/constants.ts` and `api/posts.ts` and can be enabled by uncommenting.

## Project Structure

```
src/                    React SPA
  App.tsx               Feed, detail sheet, modal orchestration, auth session
  supabaseClient.ts     Direct @supabase/auth-js + @supabase/postgrest-js client (no createClient)
  constants.ts          COUNTRIES registry (KR, UZ, RU enabled)
  translations.ts       Uzbek dictionary
  components/           PostCard, FeedCard, PostFormModal, ContactFields, LoginModal, RouteSelector, etc.
api/                    Vercel serverless functions
  posts.ts              CRUD for posts + contact reveal (?fields=contact)
  signup-start.ts       Initiates Telegram bot login session (creates signup token)
  signup-status.ts      Polls verification status of signup token
  telegram-webhook.ts   Webhook handler for Telegram bot (@elchitravel_bot)
  post-page.ts          SSR meta tags for crawler deep links (/post/:id)
  about-page.ts         SSR /about page
  sitemap.ts            Dynamic /sitemap.xml
lib/                    Shared modules (serverless + client-safe)
  supabase.ts           Anon server client
  supabase-admin.ts     Service-role admin client (server-only)
  rate-limit.ts         Postgres-backed rate limiter
  contact.ts            Contact validation (telegram handle & phone numbers)
  telegram-bot.ts       Telegram bot interaction and wizard state engine
  telegram-auth.ts      Telegram user provisioning & magic link generation
supabase-schema.sql     Full database schema + RLS policies
migrations/             Dated incremental migrations
vercel.json             Build, headers, routing & CSP configuration
```

## Local Development

**Prerequisites:** Node.js 18+, a Supabase project, Telegram Bot token.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Supabase project and execute [supabase-schema.sql](supabase-schema.sql) in the Supabase SQL Editor.
3. Copy `.env.example` to `.env` and configure environment variables:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   TELEGRAM_BOT_TOKEN=your-bot-token
   VITE_TELEGRAM_BOT_USERNAME=your_bot_username
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Deploy (Vercel)

1. Import this repository into Vercel.
2. Configure environment variables in Vercel project settings:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `VITE_TELEGRAM_BOT_USERNAME`
   - `TELEGRAM_WEBHOOK_SECRET` (optional, for webhook verification)
3. Deploy — `vercel.json` manages build output, routing, and security headers.

## API Endpoints

| Endpoint | Method | Description | Auth Required |
|---|---|---|---|
| `/api/posts` | `GET` | List active posts (supports `?country=KR\|RU`, pagination) | No |
| `/api/posts?id=<uuid>` | `GET` | Get single post details | No |
| `/api/posts?id=<uuid>&fields=contact` | `GET` | Reveal contact handles for a post | Yes (Bearer token) |
| `/api/posts` | `POST` | Create a new post (traveler or request, up to 3 contacts) | Yes (Bearer token) |
| `/api/posts?id=<uuid>` | `DELETE` | Delete own post | Yes (Bearer token, author only) |
| `/api/signup-start` | `POST` | Generate login session token for Telegram bot confirmation | No |
| `/api/signup-status?token=<uuid>` | `GET` | Poll status of login token (`pending`, `verified`, `expired`) | No |
| `/api/telegram-webhook` | `POST` | Webhook receiver for Telegram bot events | Secret Token (optional) |
| `/post/:id` | `GET` | SSR HTML with OpenGraph meta tags for link previews | No |
| `/about` | `GET` | SSR HTML explainer page for search crawlers | No |
| `/sitemap.xml` | `GET` | XML sitemap of active posts | No |
