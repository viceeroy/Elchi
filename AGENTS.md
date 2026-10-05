# AGENTS.md

Working guide for agents in this repo. Architecture detail lives in [SYSTEM.md](SYSTEM.md);
user-facing setup lives in [README.md](README.md). This file is conventions and gotchas.

## What Elchi is

A free bulletin board pairing travelers (spare luggage space) with senders (parcels) on the
Korea ↔ Uzbekistan corridor. No payments, no escrow, no messaging — the board hands over a
contact handle and gets out of the way.

Two post types: `traveler` (I'm flying, I have space) and `request` (I have a parcel). A third,
`announcement` (a standing service ad), was removed on 2026-08-07 — see
[migrations/2026-08-07-remove-announcements.sql](migrations/2026-08-07-remove-announcements.sql).
Rows written under it are kept in the table but filtered out of `public_posts`.

## Commands & Running Locally

### Fast Run Recipe (Do Not Re-analyze)

When asked to run the project, do not waste steps exploring configs, package.json, or directory structure. Follow this directly:

1. **Check if already running:**
   ```bash
   lsof -i :5173 -i :3000
   ```
   If both port 3000 (Vercel) and 5173 (Vite) are listening, the project is already up and running.

2. **Start missing services (run as daemons):**
   - **Backend API (`:3000`)**: `vercel dev --listen 3000`
   - **Frontend SPA (`:5173`)**: `npm run dev`
   *(Vite serves the SPA at `http://localhost:5173` and proxies `/api` requests to `http://localhost:3000`).*

3. **Verify:**
   - Frontend: `http://localhost:5173`
   - API Feed: `http://localhost:5173/api/posts`

### Core Commands

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

## Layout

| Path | What |
|---|---|
| [src/App.tsx](src/App.tsx) | The whole page — feed, detail sheet, modals wiring. ~1000 lines, single component |
| [src/components/](src/components) | Cards, composers, selectors, auth sheets |
| [src/explainer/](src/explainer) | Static editorial cards above the feed. **Not** posts, never touch the API |
| [src/types.ts](src/types.ts) | `Post`, `PostContact`, `Translations`, `Locale` |
| [src/constants.ts](src/constants.ts) | Country registry — the source of truth for supported routes |
| [src/translations.ts](src/translations.ts) | Uzbek copy, keyed by `Locale` |
| [api/](api) | Vercel serverless: `posts.ts` (CRUD), `signup-*.ts`, `telegram-webhook.ts` |
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
enforced in SQL (`posts_type_check`, `posts_shape_by_type_check`) — a check in
[api/posts.ts](api/posts.ts) alone is advisory.

**Validation is duplicated on purpose.** [lib/contact.ts](lib/contact.ts) runs on both sides;
the server copy is the security boundary, the client copy is inline feedback. Change both, or
change neither.

**The browser client is assembled, not `createClient`ed.**
[src/supabaseClient.ts](src/supabaseClient.ts) builds auth + PostgREST from `@supabase/auth-js`
and `@supabase/postgrest-js` directly, because `createClient` also constructs realtime, storage
and functions — none of which this app uses, none of which tree-shake, and together 86 kB of
the entry chunk. Two things it does by hand must stay by hand: the `storageKey` derivation
(auth-js's own default is a different string, so getting it wrong silently signs every existing
user out) and the per-request `Authorization` header (a static one pins the anon role and makes
`auth.uid()` null under RLS). Server code keeps the umbrella — bundle size is not a concern
there, and `getSupabaseAdmin()` needs `auth.admin`.

**Those three Supabase packages move together.** `@supabase/supabase-js` pins its
sub-dependencies to an *exact* version, so `auth-js` and `postgrest-js` are pinned exactly too
in [package.json](package.json). Bump one without the others and npm installs a second,
divergent copy instead of deduping.

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

## Git Commit & Push Workflow

Push recipe (do not re-analyze the repo):
1. `npm run lint && npm test`
2. `git status` + `git diff --stat` — confirm only task-related files changed and no `.env`/secrets.
3. Commit in logical groups (conventional commits, specific messages, never "update"/"misc").
4. Push.

Do not audit unrelated files, re-check settled config (domain, env, Supabase setup), or review
history before pushing. If you spot an unrelated problem, mention it in one line after the push.

- Group changes by logical purpose (UI/design, assets, copy, bug fixes, refactoring, config).
- Do not make one monolithic commit for everything, and do not make tiny single-file noise commits.
- Follow conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`) with short, descriptive, specific messages.
- Never use vague messages (`update`, `changes`, `fix stuff`, `misc`, `work`).
- Review `git status` / `git diff`, stage only related files per commit, verify no secrets/junk/unintended changes, and ensure the log tells a clear story before pushing.

## AI Agent Workflow

### Workflow Orchestration

#### 1. Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately -- don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

#### 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

#### 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

#### 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

#### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes -- don't over-engineer
- Challenge your own work before presenting it

#### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests -- then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

### Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

### Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

