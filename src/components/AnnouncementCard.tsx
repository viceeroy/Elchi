import React from "react";
import { Megaphone } from "lucide-react";
import { Post, Translations } from "../types";
import { derivePreview } from "../lib/postPreview";
import { useIsClamped } from "../lib/useIsClamped";
import { stickerStyle } from "../lib/stickerStyle";

interface AnnouncementCardProps {
  post: Post;
  t: Translations;
  onOpen: () => void;
}

/**
 * A note in the feed — a standing ad rather than one trip.
 *
 * Same grid, width, background, border and shadow as BoardingPass, so the two
 * sit in one column without the feed looking ragged. A note has no travel date,
 * no route and no cargo, so where the parcel card puts its trip this one puts
 * when the ad went up; the country line and the cargo line have nothing to
 * stand in for them and simply come off.
 *
 * What separates the two at a glance is edge texture, not silhouette: a solid
 * gold accent bar and a scalloped postage-stamp seam here, against the airmail
 * weave and the torn ticket perforation on a parcel card.
 *
 * The card text is derived (see ../lib/postPreview) rather than raw: the note
 * is stored with the author's emoji and line breaks intact and the detail sheet
 * renders it that way, but a fixed-height row in a column cannot afford either.
 * The stored value is never modified. The composer caps a note at NOTE_MAX =
 * 500 characters (see NoteFormModal.tsx), which is far more than the three
 * clamped lines here can show.
 *
 * The contact VALUE deliberately does NOT appear here. It lives in the detail
 * sheet, behind the same login gate as every other ad, so the feed never
 * carries a scrapeable list of handles — the stub button only opens the sheet.
 */
export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  post,
  t,
  onOpen,
}) => {
  const tagLabel = t.announcementTag || "E'lon";
  const moreLabel = t.cardMoreLabel || "ko'proq";
  const preview = derivePreview(post.headline, post.note);
  const postedDate = formatPostedDate(post.created_at, t);

  // Whether the clamp below actually cut anything, which decides if the
  // "ko'proq" cue is printed. Shared with BoardingPass so the two card types
  // can't drift apart on when the cue appears.
  const { ref: bodyRef, isClamped } = useIsClamped<HTMLParagraphElement>(preview.body);

  return (
    <article
      onClick={onOpen}
      /* h-[200px] and grid-rows-[minmax(0,1fr)] are a pair, and both are load
         bearing. The body below fills the height left over instead of clamping
         to a line count, and a fill needs something definite to fill:
         min-h-[200px] let the row size to the note's full text, so a long ad
         grew the card to 294px and the feed went ragged — the exact failure the
         old line-clamp-3 existed to prevent. Pinning the height alone was not
         enough either: a grid row defaults to auto, which has a min-content
         floor, so the row still measured 464px against a 200px card and the
         column spilled out the bottom over the card below it. minmax(0,1fr)
         removes that floor and lets the row take the card's height. */
      className="group relative grid grid-cols-[1fr_88px] sm:grid-cols-[1fr_110px] md:grid-cols-[1fr_135px] grid-rows-[minmax(0,1fr)] h-[200px] bg-card rounded-xl border border-edge transition-all duration-300 cursor-pointer shadow-[var(--shadow-card)] hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]"
      id={`post-card-${post.id}`}
    >
      {/* Left edge stripe — solid gold, the plain counterpart to the airmail
          weave on a parcel card. */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 rounded-l-xl opacity-90 pointer-events-none"
        style={{ background: "var(--color-gold)", borderRight: "1px solid var(--color-rule)" }}
      />

      {/* Left padding clears the gold stripe. Top-anchored (justify-start),
          not centred: the badge sits a fixed distance from the card's top on
          every card, whether the note is one line or five — its position was
          previously computed by centring the whole content block, so a short
          note pulled the badge down toward the middle of the card.

          One inset on all four sides, at two breakpoints: p-5 sm:p-6, taken
          from the intro note's horizontal rhythm (../notes/NoteCard.tsx,
          px-5 … sm:px-6) and now applied vertically too. A note and an ad stack
          directly on top of each other in the feed, so copy that starts at a
          different inset reads as a misalignment. This replaced a per-side ramp
          — four sides, four values, three breakpoints — that had drifted into
          pt-4/pb-5/pl-5/pr-5/sm:pl-6/sm:pr-6/md:pb-6/md:pl-6/md:pr-7; keep it
          one value, or it will drift again.

          The gold stripe (w-2, absolutely positioned) eats the first 8px of the
          left inset, so copy clears it by 12px here and 16px from sm. That is
          tighter than the old pl-5/sm:pl-8/md:pl-10 ramp — don't widen the
          stripe without revisiting this.

          Gaps between the stacked children are a single gap-2 (8px), declared
          once on the container. Each child used to carry its own margin (mt-2
          here, mb-1 there, a ternary mt-2 on the body for the no-title case)
          and they had already fallen out of step. Children below therefore set
          NO vertical margins — adding one back re-opens exactly that bug. */}
      <div className="p-5 sm:p-6 min-w-0 flex flex-col justify-start gap-2">
        {/* Badge and title share a row, which buys the note a whole extra line
            of body text — the title used to sit on its own line under the badge
            and the card spent ~29px on two half-empty rows.

            flex-wrap plus the title's min-w on purpose: where the column is
            wide enough the title sits beside the badge, and where it isn't
            (375px leaves under 100px next to the sticker) the title drops to
            its own line instead of being squeezed to three characters. The
            min-w IS the wrap threshold — lower it and narrow cards start
            truncating the title instead of wrapping it. */}
        <div className="flex flex-wrap items-center gap-2">
          <div style={stickerStyle(post.type)}>
            <Megaphone className="w-3 h-3" />
            {tagLabel}
          </div>

          {/* The theme when the author gave one, otherwise a first clause lifted
              off the note. Null when the note is short enough to be its own
              title, which is what stops it being printed twice. */}
          {preview.title && (
            <div className="min-w-[12rem] flex-1 font-bold text-[17px] sm:text-[19px] leading-[1.25] text-ink tracking-tight line-clamp-1 [overflow-wrap:anywhere]">
              {preview.title}
            </div>
          )}
        </div>

        {/* Cut on a line boundary, never mid-line. This was briefly a flex fill
            with a fade mask, which used the card's height exactly but ended on
            a half-visible line of text — the clamp gives up a few pixels of the
            card to end every note on a whole line instead.

            The counts are sized to the space left under the badge row at each
            width, with the "ko'proq" line accounted for: 3 at 375px (where the
            title wraps to its own row and eats a line) and 4 from sm up (where
            it sits beside the badge). Re-check these if the inset, the badge
            height or the leading changes.

            Full text is in the detail sheet; this is an index entry. m-0 kills
            the browser's default paragraph margin, which would otherwise add to
            the container's gap. */}
        <p
          ref={bodyRef}
          className="line-clamp-3 sm:line-clamp-4 text-[14px] sm:text-[14.5px] text-body leading-[1.5] m-0 [overflow-wrap:anywhere]"
        >
          {preview.body}
        </p>

        {/* Printed only when the clamp above actually cut something. The clamp's
            own ellipsis says the sentence stopped; this says the rest is one tap
            away, which the ellipsis alone doesn't. Not a button — the whole card
            is already the click target for the same detail sheet, so a nested
            control here would just be a second way to fire onOpen. */}
        {isClamped && (
          <span className="font-bold text-[13px] text-ink leading-none">
            {moreLabel}
          </span>
        )}
      </div>

      {/* Ticket tear-off perforation and punch notches, identical to the parcel
          card's (BoardingPass.tsx) — same markup, same offsets, same tokens.
          This was a scalloped postage-stamp seam for a while, on the theory that
          the two kinds of ad should be told apart by edge texture rather than by
          layout. That theory lost: the two card types alternate in one column,
          and a seam that changes shape row to row reads as an inconsistency
          rather than as a signal. Post type is carried by the badge colour and
          the left stripe instead. If you change the offsets here, change them in
          BoardingPass.tsx in the same commit. */}
      <div className="absolute right-[88px] sm:right-[110px] md:right-[135px] top-3 bottom-3 w-0 border-l-2 border-dashed border-rule pointer-events-none" />
      <div className="absolute right-[80px] sm:right-[102px] md:right-[127px] -top-2.5 w-4 h-4 bg-paper border border-edge rounded-full pointer-events-none" />
      <div className="absolute right-[80px] sm:right-[102px] md:right-[127px] -bottom-2.5 w-4 h-4 bg-paper border border-edge rounded-full pointer-events-none" />

      {/* Right stub — the parcel card's ticket stub, carrying the one date a
          note actually has. */}
      <div className="rounded-r-xl bg-ink text-card px-2 py-4 sm:px-3 md:py-5 md:px-4 flex flex-col justify-between items-stretch relative min-w-0">
        <div className="flex flex-col gap-0.5 text-center mt-1 md:mt-2">
          <span className="font-mono text-[8px] md:text-[9px] uppercase tracking-[1px] md:tracking-[1.5px] leading-none text-faint-on-ink">
            {t.stubPostedLabel}
          </span>
          <span className="font-mono text-[12px] sm:text-[13px] md:text-[15px] font-bold mt-0.5 text-card leading-tight">
            {postedDate}
          </span>
        </div>

        {/* Unconditional, exactly as on a parcel card: this button's job is to
            open the extended post, not to reveal a handle — it calls the same
            onOpen() that tapping the card does. Contact values never appear in
            the feed for any post type; they live in the detail sheet behind the
            login gate, which is what keeps the board from being scraped.
            Gating it on contact_type instead left four of six notes with a
            half-empty stub for no gain. */}
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="font-mono text-[9px] sm:text-[10px] md:text-[11px] bg-gold text-ink border-none py-2 px-1 md:px-2 rounded-md font-bold cursor-pointer tracking-wider leading-none hover:bg-gold-lit transition-colors shadow-sm mt-3"
          id={`stub-btn-${post.id}`}
        >
          {t.contactBtn.replace(" →", "")}
        </button>
      </div>
    </article>
  );
};

/**
 * "3 Avgust" for the stub — the same day-and-month shape the parcel card's stub
 * uses for its travel date, so the two panels read as one thing showing
 * different facts. The month name comes from the translations table, so no
 * Uzbek is spelled out here.
 *
 * No year: an announcement expires 30 days after it is posted, so the year is
 * never in doubt and would only crowd a 88px-wide panel.
 */
function formatPostedDate(createdAt: string, t: Translations): string {
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} ${t.months[d.getMonth()]}`;
}
