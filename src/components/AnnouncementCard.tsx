import React from "react";
import { Megaphone } from "lucide-react";
import { Post, Translations } from "../types";

interface AnnouncementCardProps {
  post: Post;
  t: Translations;
  onOpen: () => void;
}

/**
 * A note in the feed — a standing ad rather than one trip.
 *
 * Same width, background, border and shadow as BoardingPass so the two sit in
 * one column without the feed looking ragged, but structurally it is only the
 * sticker and the text. A note has no travel date, no route and no cargo, so
 * the stub, the country line and the tear-off perforation all come off with
 * them; the card is as short as its text, which is capped at 150 characters.
 *
 * What separates it at a glance is colour: gold, against the navy traveler and
 * red request stamps.
 *
 * The contact deliberately does NOT appear here. It lives in the detail sheet,
 * behind the same login gate as every other ad, so the feed never carries a
 * scrapeable list of handles.
 */
export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  post,
  t,
  onOpen,
}) => {
  const tagLabel = t.announcementTag || "E'lon";

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
    background: "#C79A3E",
    color: "#1B2A4A",
  };

  return (
    <article
      onClick={onOpen}
      className="group relative block bg-[#FCFBF6] rounded-xl border border-[#E9E5D8] transition-all duration-300 cursor-pointer shadow-sm hover:-translate-y-1 hover:shadow-md"
      style={{
        boxShadow: "0 1px 2px rgba(27,42,74,0.04), 0 10px 28px -18px rgba(27,42,74,0.18)",
      }}
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
        style={{ background: "#C79A3E", borderRight: "1px solid #E4E0D2" }}
      />

      {/* The whole card: the sticker above, the text here, nothing else. Left
          padding clears the gold stripe; the top clears the sticker. */}
      <div className="pt-8 pb-5 pl-5 pr-5 sm:pl-8 sm:pr-6 md:pt-8 md:pb-6 md:pl-10 md:pr-7 min-w-0">
        {/* The theme, when the author gave one — it is optional, so plenty of
            rows have none. When it is there it leads; otherwise the text
            stands alone. */}
        {post.headline && (
          <div className="font-extrabold text-[16px] sm:text-[19px] text-[#1B2A4A] tracking-tight mb-1 line-clamp-2 [overflow-wrap:anywhere]">
            {post.headline}
          </div>
        )}

        {/* Clamped so a 500-character note can't crowd the cards under it; a
            short one still keeps the card short. Full text in the detail
            sheet. */}
        <p className="text-[13.5px] sm:text-[14.5px] text-[#5A6272] leading-relaxed m-0 line-clamp-4 [overflow-wrap:anywhere]">
          {post.note}
        </p>
      </div>
    </article>
  );
};
