/**
 * The name printed in a feed card's footer — a DESIGN PLACEHOLDER, not data.
 *
 * There is no author name to print. `Post` (../types.ts) carries none on
 * purpose: the feed reads the `public_posts` view, which drops `user_id`
 * entirely so a post cannot be correlated back to whoever wrote it, and the one
 * place a name exists — `profiles.display_name` — is behind an own-row-only RLS
 * policy. See supabase-schema.sql.
 *
 * So every card in the feed currently prints the same fake name. That is
 * temporary and it reads as a bug to a real visitor. Making it real is four
 * edits, and none of them are in this file:
 *
 *   1. a dated migration joining `profiles` into the `public_posts` view and
 *      selecting `display_name` (the view is `security_invoker = false`, so it
 *      reads `profiles` as its owner and the RLS policy does not block it),
 *      folded into supabase-schema.sql as well;
 *   2. the new column added to `PUBLIC_COLUMNS` in api/posts.ts;
 *   3. the field added to `Post` in src/types.ts — nullable, because
 *      `display_name` is nullable for both auth providers;
 *   4. the two card footers reading it, with a fallback for the null case.
 *
 * That is a deliberate reversal of the board's anonymity, not a refactor —
 * hence the placeholder while the layout is being judged. Grep this symbol to
 * find every card that would have to change.
 */
export const PLACEHOLDER_AUTHOR = "Bobur K.";
