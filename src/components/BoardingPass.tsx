import React from "react";
import { Post, Locale, Translations } from "../types";
import { Briefcase, Package, ArrowRight } from "lucide-react";
import { COUNTRIES, getCountry, isHubCity } from "../constants";
import { useIsClamped } from "../lib/useIsClamped";
import { stickerStyle } from "../lib/stickerStyle";
import { flattenNote } from "../lib/postPreview";

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
  const moreLabel = t.cardMoreLabel || "ko'proq";

  // Same sanitisation an announcement body gets, minus the title split: emoji
  // out, hard line breaks flattened to single spaces. Both would otherwise
  // break the clamp arithmetic — an emoji inflates its line box, a newline
  // spends one of the two clamped lines on whitespace. The stored note is not
  // modified; the detail sheet still shows it exactly as typed.
  //
  // Can come back empty where post.note was not (a note of nothing but emoji),
  // which is why the render below tests this and not post.note.
  const noteText = flattenNote(post.note);

  // Same cue, same rule as an announcement: printed only when the note below
  // was actually cut. A parcel note is often short enough to print whole, so
  // this stays absent on most cards.
  const { ref: noteRef, isClamped } = useIsClamped<HTMLSpanElement>(noteText);

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
      /* h-[200px] with grid-rows-[minmax(0,1fr)], the same pair AnnouncementCard
         uses, so a row is exactly as tall as a row whichever card type fills it.
         This was min-h-[200px], which happened to measure 200px because the note
         below is clamped — but "happens to fit" is not the same as "cannot grow",
         and a single post that outgrew it would have made the feed ragged. The
         row needs minmax(0,...) because an auto row has a min-content floor and
         would size to the content instead of to the card. */
      className="group relative grid grid-cols-[1fr_88px] sm:grid-cols-[1fr_110px] md:grid-cols-[1fr_135px] grid-rows-[minmax(0,1fr)] h-[200px] bg-card rounded-xl border border-edge transition-all duration-300 cursor-pointer shadow-[var(--shadow-card)] hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]"
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
          post pulled the badge down toward the middle of the card.

          p-5 sm:p-6 and gap-2, the same pair AnnouncementCard uses: one inset
          on all four sides, one gap between every stacked child. The two card
          types alternate in a single column, so copy that starts at a different
          inset or stacks on a different rhythm reads as a misalignment. This
          replaced a per-side ramp (pt-5/pb-5/pl-5/pr-3/sm:pl-8/sm:pr-6/md:py-6/
          md:pl-10/md:pr-7) plus a wrapper div whose children carried their own
          mt-2/mb-2/mt-0.5 — four different gaps down one panel. Children below
          therefore set NO vertical margins. */}
      <div className="p-5 sm:p-6 flex flex-col justify-start gap-2 min-w-0">
        {/* Badge and route share a row, as the badge and title do on an
            announcement. flex-wrap plus the route's min-w is the same trick:
            beside the sticker where the column is wide enough, dropped to its
            own line at 375px, where under 100px is left next to it. */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Traveler / Request Tag Badge */}
          <div style={stickerStyle(post.type)}>
            {isTraveler ? (
              <Briefcase className="w-3 h-3 text-card" />
            ) : (
              <Package className="w-3 h-3 text-card" />
            )}
            {tagLabel}
          </div>

          {/* Destination Header (flight route is always Korea/Uzbekistan). */}
          <div className="min-w-[12rem] flex-1 flex items-center gap-2.5 font-bold text-[17px] sm:text-[19px] leading-[1.25] text-ink tracking-tight">
            <span>{hubFrom}</span>
            <span className="text-gold flex items-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </span>
            <span>{hubTo}</span>
          </div>
        </div>

        {/* Actual city (where the traveler/parcel is really going, beyond the airport) */}
        {showActualCities && (
          <div className="font-mono text-[11px] text-faint tracking-wide leading-none">
            {post.from_city} → {post.to_city}
          </div>
        )}

        {/* Post Details — description is clamped so the card height stays fixed
            regardless of note length; long URLs/words wrap instead of overflowing.
            Full text is shown in the detail modal on click. */}
        <div className="text-[14px] sm:text-[14.5px] text-body leading-[1.5] min-w-0">
          {physicalWeight && (
            <span className="text-ink font-bold block mr-1">
              {physicalWeight}
            </span>
          )}
          {/* One line below sm, two at sm and up. Sized so that a clamped note
              plus the "ko'proq" line below lands the same distance above the
              bottom inset as an announcement's text does (~7px against its
              ~4px). Three lines at sm looks like it should fit — it leaves 6px —
              but the cue underneath needs 21, so the panel spills out of the
              card. Don't raise this without re-measuring with a long note AND
              the cue present. The full note is in the detail sheet either way. */}
          {noteText && (
            <span ref={noteRef} className="line-clamp-1 sm:line-clamp-2 [overflow-wrap:anywhere]">
              · {noteText}
            </span>
          )}
        </div>

        {/* The "there is more of this in the detail sheet" cue, identical to the
            announcement card's — same label, same weight, same rule for when it
            shows. It also closes most of the gap this panel used to leave: with
            the note clamped short, a parcel card's text stopped ~23px higher
            above the bottom inset than an announcement's did. Not a button; the
            whole card already opens the same sheet. */}
        {isClamped && (
          <span className="font-bold text-[13px] text-ink leading-none">
            {moreLabel}
          </span>
        )}
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
