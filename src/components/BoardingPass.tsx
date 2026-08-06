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
import { FLEXIBLE_DATE } from "../../lib/date";
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

  // Emoji out, hard line breaks flattened to single spaces. Both would otherwise
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
  // Free-text cities are display-only detail under the country route. The null
  // check comes first because the columns are nullable — legacy rows predate
  // the constraint that makes both mandatory.
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
    // parseWeightString tolerates a missing/unparseable string: `weight` is a
    // display cache, and a legacy row predating the structured columns can
    // carry a shape it doesn't recognise.
    const { kg, luggage } = parseWeightString(post.weight);
    if (kg && kg > 0) parts.push(`${kg} kg`);
    if (luggage && luggage > 0) {
      parts.push(`${luggage} ${pluralizeChamadon(luggage)}`);
    }
    return parts.join(" + ");
  })();

  // The card omits the date entirely when it's negotiable (post.date is NULL
  // or the legacy FLEXIBLE_DATE sentinel) rather than printing "Kelishiladi" —
  // that word on every other card was noise, not information; the traveler/
  // request tab already tells you what kind of post this is. The detail sheet
  // still shows it via formatFlexibleDate directly (see App.tsx), because
  // there it's an answer to an explicit "Uchish sanasi" / "Kerak bo'lgan sana"
  // label rather than a bare word competing with the route and weight.
  const dateText =
    post.date && post.date !== FLEXIBLE_DATE
      ? formatFlexibleDate(post.date, "short", t.months)
      : null;

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

      {/* Actual city, and the date, on one row: the city line used to sit
          alone with the date on its own line below, which read as two facts
          stacked rather than one line the eye could scan across. Cities are
          absent on plenty of posts (showActualCities is false whenever both
          sides are just the hub the country name already implies) and dateText
          is null on a negotiable date (see its definition above) — each half
          renders independently so neither is required to get the other on
          screen. justify-between only matters when both are present; a lone
          date still sits left like a normal line, and a card with no fixed
          date and only hub cities shows neither and jumps straight to weight. */}
      {(showActualCities || dateText) && (
        <div className="flex items-baseline justify-between gap-2">
          {showActualCities && (
            <span className="font-mono text-[11px] text-faint tracking-wide leading-none truncate">
              {post.from_city} → {post.to_city}
            </span>
          )}
          {dateText && (
            <span className="font-bold text-[15px] text-ink leading-tight flex-shrink-0">
              {dateText}
            </span>
          )}
        </div>
      )}

      {/* Cargo, on its own line below the city/date row — the row above is
          "where and when", this is "how much", and joining all three with
          "·" separators (the original single-line design) read as one long
          fact rather than two. Keeps the same bold-ink treatment. */}
      {physicalWeight && (
        <div className="font-bold text-[15px] text-ink leading-tight">
          {physicalWeight}
        </div>
      )}

      {/* Post Details — clamped so the card height stays fixed regardless of
          note length; long URLs/words wrap instead of overflowing. Full text
          is in the detail sheet on click.

          Two lines again: putting the city and date back on one shared row
          (instead of the date on its own line below the city) gave this line
          its budget back. Measured at 218px of content in the 220px shell at
          375px width — re-measure before adding another row above this one. */}
      {noteText && (
        <span className="line-clamp-2 text-[14px] sm:text-[14.5px] text-body leading-[1.5] min-w-0 [overflow-wrap:anywhere]">
          {noteText}
        </span>
      )}

      <FeedCardFooter post={post} t={t} left={authorNameOf(post.display_name)} onOpen={onOpen} />
    </FeedCard>
  );
};
