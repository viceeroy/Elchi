/**
 * The name a feed card's footer prints, and what it falls back to.
 *
 * This file was `placeholderAuthor.ts` and held a hard-coded name — every card
 * in the feed printed the same fake person — alongside a note listing the four
 * edits that would make it real. All four have now been made: `public_posts`
 * joins `profiles` (migrations/2026-08-06-profile-display-name.sql),
 * `display_name` is in PUBLIC_COLUMNS (api/posts.ts) and on `Post`
 * (../types.ts), and both card footers read it. That is the deliberate reversal
 * of the board's anonymity the old note described, not a refactor: the feed now
 * correlates posts to a name (never to user_id, and never to a contact handle).
 *
 * What survives is the null case, and it is not rare enough to ignore. Posts
 * written before the capture gate belong to profiles whose display_name stays
 * NULL until their owner next logs in, and the oldest rows carry no user_id at
 * all, so they never resolve to a profile. Those cards need a word, and it must
 * not read as a person's name — the old placeholder did, which is exactly what
 * made it look like a bug.
 *
 * An Uzbek literal in a lib file rather than a Translations key, on purpose:
 * this is the absence of data, not copy the page composes. `t.months` is the
 * counter-example — that one had three duplicate copies inside components.
 */
export const AUTHOR_FALLBACK = "Foydalanuvchi";

/** The name to print for a post: its author's, or the fallback above. */
export function authorNameOf(displayName: string | null | undefined): string {
  return displayName?.trim() || AUTHOR_FALLBACK;
}
