import React from "react";
import { Post, Locale, Translations } from "../types";
import { Briefcase, Package, ArrowRight } from "lucide-react";
import { COUNTRIES, getCountry, isHubCity } from "../constants";

interface BoardingPassProps {
  post: Post;
  t: Translations;
  locale: Locale;
  onOpen: () => void;
}

export const BoardingPass: React.FC<BoardingPassProps> = ({
  post,
  t,
  locale,
  onOpen,
}) => {
  const isTraveler = post.type === "traveler";
  const tagLabel = isTraveler ? t.travelerTag : t.requestTag;

  // Route = country names from the stored ISO codes (the registry falls back
  // to the first entry so a malformed row can't crash the card).
  const fromCountry = getCountry(post.from_country) ?? COUNTRIES[0];
  const toCountry =
    getCountry(post.to_country) ?? COUNTRIES.find((c) => c.code !== fromCountry.code)!;
  const hubFrom = fromCountry.names[locale];
  const hubTo = toCountry.names[locale];
  // Free-text cities are display-only detail under the country route. Absent
  // entirely on an announcement, which is why the null check comes first.
  //
  // The second half hides the line when both cities are just the hubs the
  // country names already imply (Incheon → Toshkent under Koreya ✈
  // O'zbekiston). It compares against the registry's hub CITY names — the
  // earlier version compared them against hubFrom/hubTo, which are country
  // names, so a city could never equal one and the line always showed.
  const showActualCities =
    Boolean(post.from_city && post.to_city) &&
    (!isHubCity(fromCountry, post.from_city) || !isHubCity(toCountry, post.to_city));

  // Render sticker styles with distinct airmail tilt angle. In-flow, not
  // absolutely positioned — it used to hang off the card's top edge; this
  // keeps it anchored inside the card at a fixed spot regardless of the
  // label's length ("Uchaman" vs "Pochta bor").
  const stickerStyle = {
    flexShrink: 0,
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
    border: "1px dashed rgba(255,255,255,0.4)",
    transform: isTraveler ? "rotate(-2.5deg)" : "rotate(2.0deg)",
    background: isTraveler ? "var(--color-blue)" : "var(--color-red)",
    color: "var(--color-card)",
  };

  // The card shows only the physical weight (kg + luggage), stripping any
  // category labels baked into the weight string — categories are shown only in
  // the detail modal. A 0-kg value is treated as "nothing" and hidden. The
  // luggage word is stored as a neutral "chamadon" token, so the count decides
  // which Uzbek form to render.
  const physicalWeight = (() => {
    const parts: string[] = [];
    // Optional chaining because a deep link can put an announcement — which has
    // no cargo — in front of this component.
    const kg = post.weight?.match(/(\d+)\s*kg/i);
    const lug = post.weight?.match(/(\d+)\s*chamadon/i);
    if (kg && parseInt(kg[1], 10) > 0) parts.push(`${kg[1]} kg`);
    if (lug) {
      const n = parseInt(lug[1], 10);
      if (n > 0) {
        const word = n === 1 ? "chamadon" : "ta chamadon";
        parts.push(`${n} ${word}`);
      }
    }
    return parts.join(" + ");
  })();

  // Human friendly date helper
  const formatDate = (dateStr: string | null) => {
    // Null is how "no fixed date" is stored. The "flexible" string is the older
    // wire form, kept so rows written before that changed still read correctly.
    if (!dateStr || dateStr === "flexible") {
      return "Kelishiladi";
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;

      return `${d.getDate()} ${t.months[d.getMonth()]}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <article
      onClick={onOpen}
      className="group relative grid grid-cols-[1fr_88px] sm:grid-cols-[1fr_110px] md:grid-cols-[1fr_135px] min-h-[200px] bg-card rounded-xl border border-edge transition-all duration-300 cursor-pointer shadow-[var(--shadow-card)] hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]"
      id={`post-card-${post.id}`}
    >
      {/* Decorative Left Airmail Stripe */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-2 rounded-l-xl opacity-90 pointer-events-none"
        style={{
          background: "repeating-linear-gradient(-45deg, var(--color-blue), var(--color-blue) 6px, var(--color-card) 6px, var(--color-card) 12px, var(--color-red) 12px, var(--color-red) 18px, var(--color-card) 18px, var(--color-card) 24px)",
          borderRight: "1px solid var(--color-rule)"
        }}
      ></div>

      {/* Main Boarding Pass Content. Top-anchored (justify-start), not
          centred: the badge sits a fixed distance from the card's top on
          every card, whether the note is one line or five — its position was
          previously computed by centring the whole content block, so a short
          post pulled the badge down toward the middle of the card. */}
      <div className="pt-5 pb-5 pl-5 pr-3 sm:pl-8 sm:pr-6 md:py-6 md:pl-10 md:pr-7 flex flex-col justify-start min-w-0">
        <div>
          {/* Traveler / Request Tag Badge */}
          <div style={stickerStyle}>
            {isTraveler ? (
              <Briefcase className="w-3 h-3 text-card" />
            ) : (
              <Package className="w-3 h-3 text-card" />
            )}
            {tagLabel}
          </div>

          {/* Destination Header (flight route is always Korea/Uzbekistan).
              mt-2, not a bottom margin on the badge above — a fixed gap
              between the two, independent of either one's own size. */}
          <div className="mt-2 mb-2">
            <div className="flex items-center gap-2.5 font-bold text-[17px] sm:text-[19px] leading-[1.25] text-ink tracking-tight">
              <span>{hubFrom}</span>
              <span className="text-gold flex items-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </span>
              <span>{hubTo}</span>
            </div>
            {/* Actual city (where the traveler/parcel is really going, beyond the airport) */}
            {showActualCities && (
              <div className="font-mono text-[11px] text-faint tracking-wide leading-none mt-0.5">
                {post.from_city} → {post.to_city}
              </div>
            )}
          </div>

          {/* Post Details — description is clamped so the card height stays fixed
              regardless of note length; long URLs/words wrap instead of overflowing.
              Full text is shown in the detail modal on click. */}
          {/* No bottom margin: this is the last thing in the panel, so a
              trailing margin would just be dead space under the note. */}
          <div className="text-[14px] sm:text-[14.5px] text-body leading-[1.5] min-w-0">
            {physicalWeight && (
              <span className="text-ink font-bold block mr-1">
                {physicalWeight}
              </span>
            )}
            {/* The note clamps to one line below sm, two at sm and up — the
                fixed row height is what caps it, not an arbitrary line count.
                The full note is in the detail sheet either way. */}
            {post.note && (
              <span className="line-clamp-1 sm:line-clamp-2 [overflow-wrap:anywhere]">
                · {post.note}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Tear-off Divider and Punch Notches (all breakpoints, scaled to stub width) */}
      <div className="absolute right-[88px] sm:right-[110px] md:right-[135px] top-3 bottom-3 w-0 border-l-2 border-dashed border-rule pointer-events-none"></div>

      {/* Decorative Ticket Punch Holes (Notches) */}
      <div className="absolute right-[80px] sm:right-[102px] md:right-[127px] -top-2.5 w-4 h-4 bg-paper border border-edge rounded-full pointer-events-none"></div>
      <div className="absolute right-[80px] sm:right-[102px] md:right-[127px] -bottom-2.5 w-4 h-4 bg-paper border border-edge rounded-full pointer-events-none"></div>

      {/* Right Ticket Stub (Date and Call to Action) */}
      {/* md:py-5, matching AnnouncementCard's stub, so the two card types'
          stubs stay visually identical. */}
      <div className="rounded-r-xl bg-ink text-card px-2 py-4 sm:px-3 md:py-5 md:px-4 flex flex-col justify-between items-stretch relative min-w-0">
        <div className="flex flex-col gap-0.5 text-center mt-1 md:mt-2">
          <span className="font-mono text-[8px] md:text-[9px] uppercase tracking-[1px] md:tracking-[1.5px] leading-none text-faint">
            {t.stubLabel}
          </span>
          <span className="font-mono text-[12px] sm:text-[13px] md:text-[15px] font-bold mt-0.5 text-card leading-tight">
            {formatDate(post.date)}
          </span>
          <span className="font-sans text-[10px] md:text-[11px] font-semibold text-gold mt-1 flex items-center justify-center gap-1">
            <ArrowRight className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{post.to_city}</span>
          </span>
        </div>

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
