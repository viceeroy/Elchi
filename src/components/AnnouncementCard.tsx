import React from "react";
import { StickyNote } from "lucide-react";
import { Post, Locale, Translations } from "../types";
import { COUNTRIES, getCountry } from "../constants";

interface AnnouncementCardProps {
  post: Post;
  t: Translations;
  locale: Locale;
  onOpen: () => void;
}

/**
 * An announcement in the feed — a standing ad rather than one trip.
 *
 * Deliberately built on the same grid, padding and shadow as BoardingPass so
 * the two sit in one column without the feed looking ragged. What separates
 * them is colour (gold rather than the navy/red parcel stamps) and the stub,
 * which carries the note label instead of a travel date.
 */
export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  post,
  t,
  locale,
  onOpen,
}) => {
  // Same fallback as BoardingPass: the registry defaults so a malformed row
  // can't crash the card.
  const fromCountry = getCountry(post.from_country) ?? COUNTRIES[0];
  const toCountry =
    getCountry(post.to_country) ?? COUNTRIES.find((c) => c.code !== fromCountry.code)!;

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
      className="group relative grid grid-cols-[1fr_88px] sm:grid-cols-[1fr_110px] md:grid-cols-[1fr_135px] bg-[#FCFBF6] rounded-xl border border-[#E9E5D8] transition-all duration-300 cursor-pointer shadow-sm hover:-translate-y-1 hover:shadow-md"
      style={{
        boxShadow: "0 1px 2px rgba(27,42,74,0.04), 0 10px 28px -18px rgba(27,42,74,0.18)",
      }}
      id={`post-card-${post.id}`}
    >
      <div style={stickerStyle}>
        <StickyNote className="w-3 h-3" />
        {tagLabel}
      </div>

      {/* Left edge stripe — solid gold, the plain counterpart to the airmail
          weave on a parcel card. */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 rounded-l-xl opacity-90 pointer-events-none"
        style={{ background: "#C79A3E", borderRight: "1px solid #E4E0D2" }}
      />

      <div className="pt-8 pb-5 pl-5 pr-3 sm:pl-8 sm:pr-6 md:py-6 md:pl-10 md:pr-7 flex flex-col justify-between min-w-0">
        <div>
          <div className="mb-2">
            {/* The headline takes the slot the country route occupies on a
                parcel card — it is what identifies the ad at a glance. */}
            <div className="font-extrabold text-[16px] sm:text-[19px] text-[#1B2A4A] tracking-tight line-clamp-2 [overflow-wrap:anywhere]">
              {post.headline}
            </div>
            <div className="font-mono text-[11px] text-[#8A8F98] tracking-wide mt-0.5">
              {fromCountry.names[locale]} → {toCountry.names[locale]}
            </div>
          </div>

          {/* Clamped so the card keeps a parcel card's height no matter how long
              the body runs; the full text is in the detail sheet. */}
          <div className="text-[13.5px] text-[#5A6272] leading-relaxed mb-3 min-w-0">
            <span className="line-clamp-2 [overflow-wrap:anywhere]">{post.note}</span>
          </div>
        </div>
      </div>

      {/* Tear-off divider and punch notches, positioned exactly as on BoardingPass */}
      <div className="absolute right-[88px] sm:right-[110px] md:right-[135px] top-3 bottom-3 w-0 border-l-2 border-dashed border-[#E4E0D2] pointer-events-none" />
      <div className="absolute right-[80px] sm:right-[102px] md:right-[127px] -top-2.5 w-4 h-4 bg-[#F2EFE6] border border-[#E9E5D8] rounded-full pointer-events-none" />
      <div className="absolute right-[80px] sm:right-[102px] md:right-[127px] -bottom-2.5 w-4 h-4 bg-[#F2EFE6] border border-[#E9E5D8] rounded-full pointer-events-none" />

      {/* Right stub — gold, so an announcement reads as its own thing at a
          glance while keeping the ticket silhouette. No date, no city. */}
      <div className="rounded-r-xl bg-[#C79A3E] text-[#1B2A4A] px-2 py-4 sm:px-3 md:py-6 md:px-4 flex flex-col justify-between items-stretch relative min-w-0">
        <div className="flex flex-col gap-0.5 text-center mt-1 md:mt-2">
          <span className="font-mono text-[8px] md:text-[9px] uppercase tracking-[1px] md:tracking-[1.5px] text-[#1B2A4A]/60">
            {tagLabel}
          </span>
          <span className="font-sans text-[10px] md:text-[11px] font-semibold text-[#1B2A4A] mt-1 flex items-center justify-center gap-1">
            <span className="text-[9px]">➔</span>
            <span className="truncate">{toCountry.names[locale]}</span>
          </span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="font-mono text-[9px] sm:text-[10px] md:text-[11px] bg-[#1B2A4A] text-[#FCFBF6] border-none py-2 px-1 md:px-2 rounded-md font-bold cursor-pointer tracking-wider hover:bg-[#2A4B8D] transition-colors shadow-sm mt-3"
          id={`stub-btn-${post.id}`}
        >
          {t.contactBtn.replace(" →", "")}
        </button>
      </div>
    </article>
  );
};

export default AnnouncementCard;
