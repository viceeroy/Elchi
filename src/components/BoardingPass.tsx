import React from "react";
import { Post, Locale, Translations } from "../types";
import { Plane, Briefcase } from "lucide-react";
import { COUNTRIES, getCountry, isHubCity } from "../constants";
import { stickerStyle } from "../lib/stickerStyle";
import { flattenNote } from "../lib/postPreview";
import { authorNameOf } from "../lib/authorName";
import { parseWeightString } from "../../lib/weight";
import { pluralizeChamadon } from "../translations";
import { formatFlexibleDate } from "../../lib/formatDate";
import {
  FeedCard,
  FeedCardBadgeRow,
  FeedCardFooter,
  FEED_CARD_TITLE,
} from "./FeedCard";

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

  // Same sanitisation an announcement body gets, minus the title split: emoji
  // out, hard line breaks flattened to single spaces. Both would otherwise
  // break the clamp arithmetic — an emoji inflates its line box, a newline
  // spends one of the two clamped lines on whitespace. The stored note is not
  // modified; the detail sheet still shows it exactly as typed.
  //
  // Can come back empty where post.note was not (a note of nothing but emoji),
  // which is why the render below tests this and not post.note.
  const noteText = flattenNote(post.note);

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
    // post.weight is optional because a deep link can put an announcement —
    // which has no cargo — in front of this component.
    const { kg, luggage } = parseWeightString(post.weight);
    if (kg && kg > 0) parts.push(`${kg} kg`);
    if (luggage && luggage > 0) {
      parts.push(`${luggage} ${pluralizeChamadon(luggage)}`);
    }
    return parts.join(" + ");
  })();

  // Human friendly date helper
  const formatDate = (dateStr: string | null) => formatFlexibleDate(dateStr, "short", t.months);

  // The two facts a reader scans for, on one line: when, and how much. They
  // used to be a column apart — the date in the navy stub on the right, the
  // weight buried at the head of the note paragraph on the left — which meant
  // comparing two posts took two saccades in opposite directions.
  //
  // Joined here rather than by a separator element so the "·" can't survive one
  // of the two halves being absent: physicalWeight is "" on a 0 kg post, and
  // formatDate never returns "" but is filtered anyway so this holds if that
  // ever changes.
  const meta = [formatDate(post.date), physicalWeight].filter(Boolean).join(" · ");

  return (
    /* Silhouette, stripe, badge row and footer all come from ./FeedCard — this
       card is the body only. The stripe here is the airmail weave, picked from
       post.type inside FeedCard.

       The card is one column at a fixed height. It was a two-column grid —
       content plus an 88/110/135px navy ticket stub carrying the date and the
       button — and on a 375px screen the stub took a quarter of the card, which
       is what squeezed the note preview down to a single line. The stub, its
       dashed perforation and its two punch notches are all gone; the date moved
       up into the meta line and the button moved down into the footer. */
    <FeedCard post={post} onOpen={onOpen}>
      <FeedCardBadgeRow>
        {/* Traveler / Request Tag Badge — icon only; the post type reads from
            the icon and the sticker colour. */}
        <div style={stickerStyle(post.type)}>
          {isTraveler ? (
            <Plane className="w-3 h-3 text-card" />
          ) : (
            <Briefcase className="w-3 h-3 text-card" />
          )}
        </div>

        {/* Destination Header (flight route is always Korea/Uzbekistan). */}
        <div className={`${FEED_CARD_TITLE} flex items-center gap-2.5`}>
          <span>{hubFrom}</span>
          <span className="text-gold flex items-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </span>
          <span>{hubTo}</span>
        </div>
      </FeedCardBadgeRow>

      {/* Actual city (where the traveler/parcel is really going, beyond the airport) */}
      {showActualCities && (
        <div className="font-mono text-[11px] text-faint tracking-wide leading-none">
          {post.from_city} → {post.to_city}
        </div>
      )}

      {/* Date and cargo. Deliberately the heaviest type on the card after the
          route: bold ink against the grey note below it, so the two numbers a
          reader is actually comparing between posts carry without an icon
          propping them up. There were icons here in the first draft — a
          calendar and a scale — and they turned one scannable line into three
          competing glyphs. */}
      {meta && (
        <div className="font-bold text-[15px] text-ink leading-tight">
          {meta}
        </div>
      )}

      {/* Post Details — clamped so the card height stays fixed regardless of
          note length; long URLs/words wrap instead of overflowing. Full text
          is in the detail sheet on click.

          Two lines at every width, which is what set FEED_CARD_SHELL's
          h-[220px]. The budget at sm (the tighter of the two, because p-6 costs
          8px more than p-5 buys back in a shorter badge row): 48 inset + 24
          badge row + 11 city line + 19 meta + 8×4 gaps + 40 footer = 174,
          leaving 46px against the 43.5px two lines of 14.5px/1.5 need. Mobile
          has ~12px more slack. Re-measure before changing the clamp, the inset,
          the leading or the footer — three of those five have no give left. */}
      {noteText && (
        <span className="line-clamp-2 text-[14px] sm:text-[14.5px] text-body leading-[1.5] min-w-0 [overflow-wrap:anywhere]">
          {noteText}
        </span>
      )}

      <FeedCardFooter post={post} t={t} left={authorNameOf(post.display_name)} onOpen={onOpen} />
    </FeedCard>
  );
};
