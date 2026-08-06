import React from "react";
import { Megaphone } from "lucide-react";
import { Post, Translations } from "../types";
import { derivePreview } from "../lib/postPreview";
import { stickerStyle } from "../lib/stickerStyle";
import { authorNameOf } from "../lib/authorName";
import { formatPostedDate } from "../../lib/formatDate";
import {
  FeedCard,
  FeedCardBadgeRow,
  FeedCardFooter,
  FEED_CARD_TITLE,
} from "./FeedCard";

interface AnnouncementCardProps {
  post: Post;
  t: Translations;
  onOpen: () => void;
}

/**
 * A note in the feed — a standing ad rather than one trip.
 *
 * Shares its chrome with BoardingPass by construction — silhouette, stripe,
 * badge row and footer all come from ./FeedCard, so the two sit in one column
 * without the feed looking ragged. A note has no travel date, no route and no
 * cargo, so the country line and the cargo line simply come off and the body
 * starts one row higher; the one date it does have — when the ad went up —
 * rides in the footer beside the author.
 *
 * What separates the two at a glance is the left edge alone: a solid gold accent
 * bar here against the airmail weave on a parcel card, chosen from post.type
 * inside FeedCard. The scalloped postage-stamp seam this card used to carry, and
 * the ticket perforation that replaced it, are both gone along with the navy
 * stub they belonged to.
 *
 * The card text is derived (see ../lib/postPreview) rather than raw: the note
 * is stored with the author's emoji and line breaks intact and the detail sheet
 * renders it that way, but a fixed-height row in a column cannot afford either.
 * The stored value is never modified. The composer caps a note at NOTE_MAX =
 * 500 characters (see NoteFormModal.tsx), which is far more than the clamped
 * lines here can show.
 *
 * The contact VALUE deliberately does NOT appear here. It lives in the detail
 * sheet, behind the same login gate as every other ad, so the feed never
 * carries a scrapeable list of handles — the footer button only opens the sheet.
 */
export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  post,
  t,
  onOpen,
}) => {
  const preview = derivePreview(post.headline, post.note);
  const postedDate = formatPostedDate(post.created_at, t.months);

  return (
    <FeedCard post={post} onOpen={onOpen}>
      <FeedCardBadgeRow>
        <div style={stickerStyle(post.type)}>
          <Megaphone className="w-3 h-3" />
        </div>

        {/* The theme when the author gave one, otherwise a first clause lifted
            off the note. Null when the note is short enough to be its own
            title, which is what stops it being printed twice. */}
        {preview.title && (
          <div className={`${FEED_CARD_TITLE} line-clamp-1 [overflow-wrap:anywhere]`}>
            {preview.title}
          </div>
        )}
      </FeedCardBadgeRow>

      {/* Cut on a line boundary, never mid-line. This was briefly a flex fill
          with a fade mask, which used the card's height exactly but ended on
          a half-visible line of text — the clamp gives up a few pixels of the
          card to end every note on a whole line instead.

          The counts are sized to the space left under the badge row at each
          width, with the footer accounted for: 3 at 375px (where the title
          wraps to its own row and eats a line) and 4 from sm up (where it sits
          beside the badge). They survived the stub coming off because this
          card gained a footer (~40px) at the same time as it gained the note's
          old two-column width back. Re-check them if the inset, the badge
          height, the leading or the footer changes.

          Full text is in the detail sheet; this is an index entry. m-0 kills
          the browser's default paragraph margin, which would otherwise add to
          the container's gap. */}
      <p className="line-clamp-3 sm:line-clamp-4 text-[14px] sm:text-[14.5px] text-body leading-[1.5] m-0 [overflow-wrap:anywhere]">
        {preview.body}
      </p>

      {/* The posted date rides beside the author because a note has no travel
          date to have put in a meta line. */}
      <FeedCardFooter
        post={post}
        t={t}
        left={`${authorNameOf(post.display_name)} · ${postedDate}`}
        onOpen={onOpen}
      />
    </FeedCard>
  );
};
