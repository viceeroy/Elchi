import React from "react";
import { Post, Translations } from "../types";

/**
 * The chrome every feed card wears — silhouette, left stripe, inner column,
 * badge row and footer. One definition; the bodies are what differ.
 *
 * This lived as a copy-paste pair in BoardingPass and AnnouncementCard,
 * identical apart from the stripe's background and the footer's left string,
 * and both files carried comments begging the next editor to keep them in step
 * ("the two cards have drifted twice"). They had drifted twice. The loading
 * skeleton in App.tsx traced the same shape a third time and was, for a while,
 * still drawing a card silhouette the cards themselves had retired.
 *
 * Same extraction as ../lib/stickerStyle.ts, for the same reason.
 *
 * The class strings are exported alongside the components because the skeleton
 * is not one of these cards — it has no click target, no stripe and no text —
 * so it consumes the geometry without pretending to be a card.
 */

/**
 * Silhouette, minus interaction: FeedCard adds the hover/cursor/transition set,
 * the skeleton adds animate-pulse instead.
 *
 * h-[220px] is pinned rather than left to the content because both card types
 * alternate in ONE column, and a card that sizes to its own text makes that
 * column ragged. It is also the number the note clamps in both bodies were
 * measured against (see the arithmetic in BoardingPass.tsx and
 * AnnouncementCard.tsx) — changing it here changes what fits there.
 */
export const FEED_CARD_SHELL =
  "relative flex flex-col h-[220px] bg-card rounded-xl border border-edge shadow-[var(--shadow-card)]";

/**
 * The padded column inside the shell.
 *
 * One inset on all four sides at two breakpoints (p-5 sm:p-6), taken from the
 * intro note's horizontal rhythm (../notes/NoteCard.tsx) and applied vertically
 * too: the two card types and the note stack directly on each other in the feed,
 * so copy that starts at a different inset reads as a misalignment. Each card
 * previously ran its own per-side ramp — four sides, three breakpoints — and
 * both had drifted.
 *
 * Gaps between stacked children are a single gap-2 (8px), declared once here.
 * Children set NO vertical margins; they used to carry their own mt-2/mb-1/
 * mt-0.5 and had fallen out of step. Adding one back re-opens that bug.
 *
 * justify-start, not centred: the badge sits a fixed distance from the card's
 * top whether the note is one line or five. Centring the block pulled the badge
 * of a short post down toward the middle of the card.
 *
 * The stripe (w-2, absolutely positioned) eats the first 8px of the left inset,
 * so copy clears it by 12px here and 16px from sm. Don't widen the stripe
 * without revisiting this.
 */
export const FEED_CARD_INNER =
  "p-5 sm:p-6 flex flex-1 min-h-0 flex-col justify-start gap-2 min-w-0";

/**
 * Footer row — author (plus whatever else the card puts beside it) on the left,
 * the way out on the right, under a rule. mt-auto pins it to the bottom inset
 * whatever the body above did, so the rule sits at the same height on every card
 * in the column.
 *
 * There is no "ko'proq" cue: the body clamps' own ellipsis already says the
 * sentence stopped, the whole card is the click target, and the button is a
 * third way to say the same thing. Dropping it also bought the parcel card's
 * note its second line.
 */
export const FEED_CARD_FOOTER_ROW =
  "mt-auto pt-3 border-t border-rule flex items-center justify-between gap-3";

/**
 * Title typography, shared by the announcement's headline and the parcel card's
 * route so the two read as the same rung of the hierarchy.
 *
 * The min-w IS the wrap threshold for FeedCardBadgeRow: where the column is wide
 * enough the title sits beside the sticker, and at 375px — where under 100px is
 * left next to it — it drops to its own line instead of being squeezed to three
 * characters. Lower it and narrow cards start truncating.
 */
export const FEED_CARD_TITLE =
  "min-w-[12rem] flex-1 font-bold text-[17px] sm:text-[19px] leading-[1.25] text-ink tracking-tight";

/**
 * The left edge stripe, and the ONLY thing that tells the two card types apart
 * at a glance: an airmail weave on a parcel card, a solid gold bar on an
 * announcement. Load bearing, not decoration — the scalloped stamp seam, the
 * ticket perforation and the navy stub that used to do this job are all gone.
 */
const AIRMAIL_WEAVE =
  "repeating-linear-gradient(-45deg, var(--color-blue), var(--color-blue) 6px, var(--color-card) 6px, var(--color-card) 12px, var(--color-red) 12px, var(--color-red) 18px, var(--color-card) 18px, var(--color-card) 24px)";

interface FeedCardProps {
  post: Post;
  onOpen: () => void;
  children: React.ReactNode;
}

/** Silhouette + stripe + padded column. `children` are the card's own body. */
export const FeedCard: React.FC<FeedCardProps> = ({ post, onOpen, children }) => (
  <article
    onClick={onOpen}
    className={`group ${FEED_CARD_SHELL} transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]`}
    id={`post-card-${post.id}`}
  >
    <div
      className="absolute left-0 top-0 bottom-0 w-2 rounded-l-xl opacity-90 pointer-events-none"
      style={{
        background:
          post.type === "announcement" ? "var(--color-gold)" : AIRMAIL_WEAVE,
        borderRight: "1px solid var(--color-rule)",
      }}
    />

    <div className={FEED_CARD_INNER}>{children}</div>
  </article>
);

/**
 * Sticker and title on one row. Wrapping is deliberate — see FEED_CARD_TITLE for
 * why the title carries a min-w rather than shrinking.
 *
 * Sharing the row buys the body a whole extra line: the title used to sit on its
 * own line under the sticker and the card spent ~29px on two half-empty rows.
 */
export const FeedCardBadgeRow: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="flex flex-wrap items-center gap-2">{children}</div>;

interface FeedCardFooterProps {
  post: Post;
  t: Translations;
  /** Author, and whatever else this card type puts beside it. */
  left: React.ReactNode;
  onOpen: () => void;
}

export const FeedCardFooter: React.FC<FeedCardFooterProps> = ({
  post,
  t,
  left,
  onOpen,
}) => (
  <div className={FEED_CARD_FOOTER_ROW}>
    <span className="text-[13px] text-faint truncate">{left}</span>

    {/* Unconditional, and on every post type: this button's job is to open the
        extended post, not to reveal a handle — it fires the same onOpen() that
        tapping the card does. Contact VALUES never travel in a list response;
        they come one at a time from get_post_contact() behind the login gate,
        which is what keeps the board from being scrapeable. stopPropagation so
        the card's own handler doesn't fire a second time behind it. */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="flex-shrink-0 font-mono text-[11px] bg-gold text-ink border-none py-2 px-3 rounded-md font-bold cursor-pointer tracking-wider leading-none hover:bg-gold-lit transition-colors shadow-sm"
      id={`contact-btn-${post.id}`}
    >
      {t.contactBtn}
    </button>
  </div>
);
