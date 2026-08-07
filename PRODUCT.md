# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences of equal weight, both served by the same feed:

- **Senders** — people (largely the Uzbek diaspora in Korea) with a parcel that needs to reach
  Uzbekistan, or the reverse. They arrive to scan for someone already flying.
- **Travelers** — people with a booked KR↔UZ flight and spare luggage allowance. They arrive to
  post once and then wait to be contacted.

Neither side is the primary. The feed, the card design, and the composer are deliberately
symmetric: a `traveler` post and a `request` post are the same object shape with the same
affordances, distinguished by stamp color and direction, not by hierarchy.

## Product Purpose

Elchi is a free bulletin board for the Korea ↔ Uzbekistan parcel corridor. It stores an ad and,
to a logged-in viewer, reveals a contact handle. Everything after that — negotiation, handoff,
payment, trust — happens off-platform.

Success is a contact reveal that leads to a real handoff. The product does not observe or
measure that, and is not designed to.

## Positioning

The board matches nobody and handles no money. That is the mechanism, not a missing feature.
There is no escrow, no ratings, no messaging, no transaction — the value is a *fast, free,
uncluttered* list of the two things that matter (who is flying when, and who has a parcel), plus
one authenticated handoff of a contact handle.

## Operating Context

- Overwhelmingly mobile, often on Korean or Uzbek mobile networks.
- Sessions are short and scan-shaped: open the feed, read stamps and dates, reveal one contact.
- Posts expire. `expires_at` is a hard filter in the read model, so the feed is always "live",
  never an archive.
- Reading is anonymous. Posting, deleting, and revealing a contact all require a session
  (Google OAuth or a Telegram bridge).

## Capabilities and Constraints

- **Two post types only:** `traveler` (flying, has space) and `request` (has a parcel). A third
  type, `announcement`, was removed on 2026-08-07; rows survive in the table but are filtered out
  of the `public_posts` view, and no component renders them.
- **Contact values never travel in a list response.** The feed reads `public_posts`, which omits
  `contact` / `contact2` / `user_id`. Handles come one post at a time from `get_post_contact()`,
  authenticated only. *(User-confirmed as the binding constraint on all future design work: no
  design may surface a handle in a list, a preview, a hover, or an aggregate.)*
- **No payments, no escrow, no in-app messaging.** (Codebase-evidenced; not re-confirmed in this
  interview.)
- **Uzbek only.** `Locale` is a union of one (`"uz"`). The per-locale shape in `Translations` and
  `COUNTRIES.names` is kept so a second locale stays additive. No hardcoded Uzbek strings in
  components. (Codebase-evidenced.)
- **User-facing errors are Uzbek and generic.** API error strings go straight to the user; they
  must not leak database detail.
- **Supported routes come from a country registry.** `COUNTRIES` in `src/constants.ts` plus
  `ALLOWED_COUNTRIES` in `api/posts.ts`. KZ/TJ/KG/TM are pre-written and commented out.

## Brand Commitments

The name is Elchi (Uzbek: *envoy / messenger*). The interface leans on postal and air-travel
iconography — boarding-pass stubs, rubber stamps, airmail striping — as its identity. There is
no logo file and no external brand guide; the code is the identity.

## Evidence on Hand

**None.** There are no user counts, no testimonials, no reviews, no case studies, no press, no
trust badges, and no partner logos. *(User-confirmed.)* Future design work must not fabricate
any of these, and must not design surfaces whose composition depends on social proof existing.

The only real content the product has is the posts themselves and the static editorial cards in
`src/notes/`, which are hand-written, are not posts, and never touch the API.

## Product Principles

1. **The board gets out of the way.** Every screen's job is to move a visitor toward one contact
   reveal, then stop.
2. **Both sides are peers.** Traveler and sender receive identical structural weight; asymmetry
   is expressed through color and direction only.
3. **Handles are the only asset worth stealing.** Design decisions that would make bulk contact
   harvesting cheaper are non-starters, regardless of the convenience they buy.
4. **The feed is live, never an archive.** Expired posts disappear; nothing invites browsing
   history.
5. **Nothing is claimed that isn't true.** No proof, no metrics, no reassurance the product
   cannot actually deliver.

## Accessibility & Inclusion

No user-specific standard was established in this interview. The incumbent implementation
targets WCAG AA contrast deliberately and documents measured ratios in
`src/index.css` — treat AA on real backgrounds as the inherited floor.
