# Elchi Explainer Video Scripts & Production Plan

This document outlines the video strategy, scene-by-scene scripts, visual storyboards, and production guides to explain the **Elchi** project across different target audiences.

---

## 1. Overview of Video Strategy

| Video | Title | Target Audience | Length | Focus / Core Message |
|---|---|---|---|---|
| **Video 1** | **How Elchi Works: Community Parcel Board** | End Users (Travelers & Senders) | 60–90 sec | Problem, posting luggage/parcels, Telegram auth, direct contact |
| **Video 2** | **Full System & Technical Architecture** | Developers, Tech Leads, Reviewers | 3–5 min | React 19, Supabase RLS, Telegram auth bridge, anti-scraping security |
| **Video 3** | **Quick Hook Short / Reel** | Social Media (TikTok, Reels, Shorts) | 30–45 sec | Quick problem/solution hook: "Traveling to Tashkent with empty suitcase space?" |

---

## Video 1: Product Explainer (End-User & Community)
- **Target Audience:** Uzbek diaspora, travelers between Korea/Russia and Uzbekistan, senders needing urgent parcel delivery.
- **Tone:** Friendly, reliable, clear, community-driven.
- **Primary Corridor Focus:** Korea ↔ Uzbekistan (`KR` ↔ `UZ`) & Russia ↔ Uzbekistan (`RU` ↔ `UZ`).

### Scene-by-Scene Storyboard

#### Scene 1: The Problem (0:00 – 0:15)
- **Visual:** Split screen / animation. Left: Traveler with half-empty luggage at Incheon Airport. Right: Sender in Seoul holding urgent documents or gifts for family in Tashkent, wondering how to send them affordably without long postal delays.
- **On-Screen Text:** "Sending parcels to Uzbekistan? Empty luggage space on your flight?"
- **Voiceover (EN):** "Traveling between Korea, Russia, and Uzbekistan with spare luggage space? Or do you have an urgent parcel that needs to reach home fast? Traditional shipping can be slow and expensive, while informal social media groups are cluttered and messy."

#### Scene 2: Introducing Elchi (0:15 – 0:30)
- **Visual:** Clean screen recording / mock-up showing the Elchi web app loading smoothly on mobile. Showcase the header: "Elchi 🇰🇷 🇷🇺 ↔ 🇺🇿" and the two-tab filter (Korea ↔ Uzbekistan and Russia ↔ Uzbekistan).
- **On-Screen Text:** "Elchi — Direct, Free, Community-Driven"
- **Voiceover (EN):** "Meet Elchi — the free, dedicated bulletin board connecting travelers who have spare luggage capacity with senders who need a ride for their packages."

#### Scene 3: How to Browse and Reveal Contacts (0:30 – 0:50)
- **Visual:** Cursor scrolling through the feed of clean airmail-styled cards (blue cards for travelers, red cards for parcel requests). Clicking a card opens the detail sheet showing dates, weight allowance (e.g. 5 kg, 23 kg), and route. Tapping the gold "Bog'lanish" (Connect) button triggers a quick Telegram verification to reveal direct Telegram / phone handles.
- **On-Screen Text:** "No middlemen. No transaction fees. Direct contact."
- **Voiceover (EN):** "Browsing is completely free and open. When you find a matching flight or parcel, verify via Telegram in one tap to instantly reveal the traveler's contact handle. You arrange the handover directly — no fees, no escrow, no middleman taking a cut."

#### Scene 4: How to Post an Ad (0:50 – 1:10)
- **Visual:** Tapping the circular action button (+), switching between Traveler and Request tabs. Filling out route (e.g. Seoul to Tashkent), departure date, available kilograms, and contact handle. Submitting and seeing it instantly appear on the live feed.
- **On-Screen Text:** "Post in under 60 seconds."
- **Voiceover (EN):** "Flying soon? Post your departure date, spare kilograms, and your preferred contact. Senders can get in touch with you immediately to help cover your travel costs."

#### Scene 5: Outro & Call to Action (1:10 – 1:25)
- **Visual:** Elchi logo with PWA prompt ("Add to Home Screen"). Corridors listed: Korea ↔ Uzbekistan and Russia ↔ Uzbekistan. URL displayed clearly on screen.
- **On-Screen Text:** "Open the board. Find your match today."
- **Voiceover (EN):** "Simple, lightweight, and built for our community. Visit Elchi today or add it to your phone's home screen."

---

## Video 2: Engineering & System Architecture Walkthrough
- **Target Audience:** Software engineers, open-source contributors, technical recruiters, tech leads.
- **Tone:** Technical, architectural, security-conscious.
- **Duration:** ~3 to 4 minutes.

### Scene-by-Scene Script

#### Scene 1: System Purpose & Core Constraints (0:00 – 0:45)
- **Visual:** Architecture diagram displaying the threat model and core principle.
  - Read model: Anonymous feed browsing.
  - Write model: Authenticated posting and contact reveals.
  - Asset protection: Contact handles are protected against automated scraping.
- **Voiceover (EN):** "Elchi is an open bulletin board connecting travelers and senders on the Korea-Uzbekistan and Russia-Uzbekistan corridors. Because Elchi handles no payments or escrow, user contact handles are the only high-value asset. Consequently, the entire system architecture is shaped around anti-scraping defense, low latency, and zero-cost operational overhead."

#### Scene 2: Modern Full-Stack Architecture (0:45 – 1:30)
- **Visual:** Diagram of the stack components:
  - Frontend: React 19, Vite 6, Tailwind CSS v4, PWA Workbox cache.
  - Edge/API: Vercel Serverless Functions (`/api/posts`, `/api/signup-start`, `/api/telegram-webhook`).
  - Database: Supabase Postgres 15+ with Row-Level Security (RLS).
- **Voiceover (EN):** "The frontend is built with React 19 and Vite 6 styled with Tailwind v4 design tokens. It functions as an installable PWA with Workbox network-first caching. The backend runs on Vercel Serverless Functions, interfacing with Supabase Postgres. Because the client holds the anon Supabase key, all data boundaries are enforced directly in the database with strict Row Level Security."

#### Scene 3: Database Design & Anti-Scraping Defense (1:30 – 2:30)
- **Visual:** Code snippet of `public_posts` view and `get_post_contact(p_id)` stored procedure.
  - Highlighting `security_invoker = false` on `public_posts`.
  - Highlighting that `SELECT` on `posts` is revoked for anonymous and authenticated users except for owned IDs.
  - Highlighting the Postgres-backed rate limiter (`rate_limits` table).
- **Voiceover (EN):** "In the database, a single `posts` table handles both travelers and requests via strict CHECK constraints. Direct SELECT access to the `posts` table is revoked. Anonymous visitors query a `public_posts` view that completely strips contact information and author IDs. Contact handles can only be retrieved via a SECURITY DEFINER function `get_post_contact()`, accessible only to authenticated users with per-account rate limits (60 reveals per 10 minutes). Even if a scraper bypasses the Vercel API and attacks PostgREST directly, bulk harvesting remains computationally and economically prohibitive."

#### Scene 4: Telegram Authentication & Webhook Flow (2:30 – 3:15)
- **Visual:** Sequence diagram of Telegram Bot confirmation flow:
  1. User clicks login → Client hits `/api/signup-start` (generates temporary session token).
  2. Deep link opens `@elchitravel_bot` in Telegram app.
  3. User presses 'Start' → Telegram webhook verifies user identity.
  4. Serverless bridge provisions synthetic user `telegram_<id>@elchi.local` via Supabase Admin API.
  5. Browser polling `/api/signup-status` receives session and logs in without passwords.
- **Voiceover (EN):** "Authentication uses Telegram as the identity provider. When a user requests login, a secure session token is generated, redirecting them to the official Elchi Telegram bot. Once confirmed, a serverless webhook verifies the payload and provisions a synthetic Supabase session. This eliminates password storage, prevents SMS costs, and verifies that posters own a legitimate Telegram account."

#### Scene 5: Extensibility & Conclusion (3:15 – 3:45)
- **Visual:** Showing `src/constants.ts` with prepared corridors (`KZ`, `TJ`, `KG`, `TM`) and `translations.ts` structured for multi-locale expansion.
- **Voiceover (EN):** "The platform is designed to scale horizontally across Central Asian corridors by uncommenting country definitions, with complete type safety and SEO server-side rendering for social crawlers. Check out the repository to explore the codebase."

---

## 3. Video Production Checklist & Recommended Tools

1. **Screen Capture:**
   - Run `npm run dev` to capture live interactions in Chrome DevTools using responsive mobile view (iPhone 14 / Pixel 7 aspect ratio: 390x844).
2. **Audio / Voiceover:**
   - Use high-fidelity TTS (ElevenLabs / OpenAI Voice / Google Cloud TTS) or natural recorded voice.
3. **Motion Graphics / Titles:**
   - Create title cards using Canva, Remotion, or Screen Studio.
4. **Music / Audio Bed:**
   - Subtle, upbeat lo-fi or modern acoustic background music at -22dB under speech.
