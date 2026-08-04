import React from "react";
import { Megaphone } from "lucide-react";
import { Post, Translations } from "../types";
import { derivePreview } from "../lib/postPreview";

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
  const preview = derivePreview(post.headline, post.note);
  const postedDate = formatPostedDate(post.created_at, t);

  // Matches the parcel sticker's geometry, tilted the other way from the
  // traveler stamp so a run of cards doesn't read as a repeating pattern.
  const stickerStyle = {
    position: "absolute" as const,
    top: -10,
    left: 20,
    zIndex: 10,
    fontFamily: "'Space Mono', monospace",
    fontSize: "10.5px",
    letterSpacing: "1px",
    textTransform: "uppercase" as const,
    padding: "6px 12px",
    borderRadius: 4,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    boxShadow: "0 3px 8px rgba(27,42,74,0.15)",
    border: "1px dashed rgba(27,42,74,0.25)",
    transform: "rotate(-1.5deg)",
    background: "var(--color-gold)",
    color: "var(--color-ink)",
  };

  return (
    <article
      onClick={onOpen}
      className="group relative grid grid-cols-[1fr_88px] sm:grid-cols-[1fr_110px] md:grid-cols-[1fr_135px] min-h-[148px] bg-card rounded-xl border border-edge transition-all duration-300 cursor-pointer shadow-[var(--shadow-card)] hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]"
      id={`post-card-${post.id}`}
    >
      <div style={stickerStyle}>
        <Megaphone className="w-3 h-3" />
        {tagLabel}
      </div>

      {/* Left edge stripe — solid gold, the plain counterpart to the airmail
          weave on a parcel card. */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 rounded-l-xl opacity-90 pointer-events-none"
        style={{ background: "var(--color-gold)", borderRight: "1px solid var(--color-rule)" }}
      />

      {/* The sticker sits above; the text here. Left padding clears the gold
          stripe, the top clears the sticker, and the content centres in
          whatever height is left once min-h-[148px] has had its say — so a
          sixteen-character note doesn't hang off the top of an empty card. */}
      {/* md:pb-5, not the pb-6 the rest of the scale would suggest: at md the
          title (23.75px) + its 4px gap + three body lines (65.25px) + 32px top
          padding + the 2px border come to 151px, and a 24px bottom padding
          pushes the card 3px past the 148px the feed is built on. 20px lands
          it at 147px and lets min-h-[148px] set the final height. */}
      <div className="pt-8 pb-5 pl-5 pr-5 sm:pl-8 sm:pr-6 md:pt-8 md:pb-5 md:pl-10 md:pr-7 min-w-0 flex flex-col justify-center">
        {/* The theme when the author gave one, otherwise a first clause lifted
            off the note. Null when the note is short enough to be its own
            title, which is what stops it being printed twice. */}
        {preview.title && (
          <div className="font-bold text-[17px] sm:text-[19px] leading-[1.25] text-ink tracking-tight mb-1 line-clamp-1 [overflow-wrap:anywhere]">
            {preview.title}
          </div>
        )}

        {/* Clamped so a 500-character note can't crowd the cards under it; a
            short one still keeps to the same height. Full text in the detail
            sheet. */}
        <p className="text-[14px] sm:text-[14.5px] text-body leading-[1.5] m-0 line-clamp-3 [overflow-wrap:anywhere]">
          {preview.body}
        </p>
      </div>

      {/* Scalloped seam — paper-coloured half-circles punched down the join, the
          edge of a postage stamp. Deliberately NOT the parcel card's dashed
          perforation and punch notches: same silhouette, different texture, so
          the two kinds of ad are told apart by feel rather than by layout.
          Centred on the seam via the half-width nudge, so each circle reads as
          a bite out of both panels at once. */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 right-[88px] sm:right-[110px] md:right-[135px] w-[9px] translate-x-1/2 z-[5]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, var(--color-paper) 3.5px, transparent 4px)",
          backgroundSize: "9px 12px",
          backgroundRepeat: "repeat-y",
        }}
      />

      {/* Right stub — the parcel card's ticket stub, carrying the one date a
          note actually has. */}
      <div className="rounded-r-xl bg-ink text-card px-2 py-4 sm:px-3 md:py-5 md:px-4 flex flex-col justify-between items-stretch relative min-w-0">
        <div className="flex flex-col gap-0.5 text-center mt-1 md:mt-2">
          <span className="font-mono text-[8px] md:text-[9px] uppercase tracking-[1px] md:tracking-[1.5px] leading-none text-faint">
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
