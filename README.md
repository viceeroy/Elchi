# Elchi 🇰🇷 ↔ 🇺🇿

Seoul ✈ Tashkent — free bulletin board connecting travelers and senders for parcel delivery between Korea and Uzbekistan.

Travelers post available luggage space; senders post parcels needing a ride. No accounts, no payments — just a contact exchange.

## Stack

- **Frontend:** React 19 + Vite 6 + Tailwind v4
- **Backend:** Vercel Serverless Functions (`api/`)
- **Database:** Supabase (Postgres + RLS)
- **i18n:** Uzbek / Russian / English (`src/translations.ts`)

## Project structure

```
src/            React SPA (components, i18n, types)
api/            Vercel serverless functions (posts, reports)
lib/supabase.ts Supabase client
supabase-schema.sql   DB schema + RLS policies
vercel.json     Build + routing config
```

## Local development

**Prerequisites:** Node.js 18+, a Supabase project

1. Install dependencies:
   ```
   npm install
   ```
2. Create a Supabase project and run [supabase-schema.sql](supabase-schema.sql) in the SQL Editor.
3. Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```
4. Run the app:
   ```
   npm run dev
   ```

## Deploy (Vercel)

1. Import this repo into Vercel.
2. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as environment variables (Production + Preview).
3. Deploy — `vercel.json` handles build output and API routing.

## Supabase MCP Server

This repository is integrated with the **Supabase Model Context Protocol (MCP)** server. This allows AI development tools (such as Claude, Cursor, and Antigravity) to securely manage database schemas, inspect tables, deploy Edge Functions, and run migrations in your Supabase workspace.

To configure the Supabase MCP server, provide the project reference `twxvbbwhjdjnwbxakopv` and your Supabase Personal Access Token (PAT) to your AI client configuration.

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/posts` | `GET` | List active (non-expired) posts |
| `/api/posts` | `POST` | Create a post (traveler or request) |
| `/api/reports` | `POST` | Report a post |
