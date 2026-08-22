import React from "react";
import { Post, Locale, Translations } from "../types";
import { Plane, Briefcase } from "lucide-react";
import { COUNTRIES, getCountry } from "../constants";
import { stickerStyle } from "../lib/stickerStyle";
import { flattenNote } from "../lib/postPreview";
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

interface PostCardProps {
  post: Post;
  t: Translations;
  locale: Locale;
  onOpen: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({
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
  const dateText = (() => {
    if (!post.date || post.date === FLEXIBLE_DATE) return null;
    const formatted = formatFlexibleDate(post.date, "short", t.months);

    if (isTraveler) {
      const flightDate = new Date(post.date);
      flightDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const diffTime = flightDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 7) {
        return (
          // px-1 gives it a bit of padding so that the -2px/2px translateX 
          // isn't clipped by the parent FeedCardFooter's `truncate` (overflow: hidden).
          <span className="inline-block px-1 animate-shake-pause text-red font-bold">
            {formatted}
          </span>
        );
      }
    }
    return <span className="font-bold">{formatted}</span>;
  })();
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
    <FeedCard post={post} t={t} onOpen={onOpen}>
      <FeedCardBadgeRow>
        {/* Traveler / Request Tag Badge — icon only visually, so the type still
            needs a spoken name: sighted users read colour + icon, but a screen
            reader gets nothing from either. travelerTag/requestTag are the
            text labels the icon replaced ("Yo'lovchi" / "Jo'natma") — reused
            here as the accessible name rather than inventing a second string. */}
        <div style={stickerStyle(post.type)} role="img" aria-label={isTraveler ? t.travelerTag : t.requestTag}>
          {isTraveler ? (
            <Plane className="w-3 h-3 text-card" aria-hidden="true" />
          ) : (
            <Briefcase className="w-3 h-3 text-card" aria-hidden="true" />
          )}
        </div>

        {/* Destination Header (flight route is always Korea/Uzbekistan). The
            arrow is decorative — the route is already spelled out in hubFrom/
            hubTo either side of it — so it's aria-hidden. Colour moved off
            `gold` (2.50:1 on card, background-only per the token's own rule)
            onto `gold-deep`, which clears AA (5.35:1). */}
        <div className={`${FEED_CARD_TITLE} flex items-center gap-2.5`}>
          <span>{hubFrom}</span>
          <span className="text-gold-deep flex items-center" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </span>
          <span>{hubTo}</span>
        </div>
      </FeedCardBadgeRow>



      {/* Cargo weight/items on its own row. */}
      {physicalWeight && (
        <div className="flex items-center flex-wrap gap-1.5 font-bold text-[15px] text-ink leading-tight">
          <span>{physicalWeight}</span>
        </div>
      )}

      {/* Post Details — clamped so the card height stays fixed regardless of
          note length; long URLs/words wrap instead of overflowing. Full text
          is in the detail sheet on click.

          Now increased to 3 lines because removing the footer border line and
          reducing its padding freed up enough vertical budget. */}
      {noteText && (
        <span className="line-clamp-3 text-[14px] sm:text-[14.5px] text-body leading-[1.5] min-w-0 [overflow-wrap:anywhere]">
          {noteText}
        </span>
      )}

      <FeedCardFooter post={post} t={t} left={dateText} onOpen={onOpen} />
    </FeedCard>
  );
};
