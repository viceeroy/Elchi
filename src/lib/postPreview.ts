// Card-preview text for a post's note.
//
// The feed and the detail sheet want different things from the same column. The
// sheet is the record: it renders `post.note` raw, with `whitespace-pre-wrap`,
// so the author's line breaks and emoji survive exactly as typed. The card is an
// index entry: a clamped trailing clause in a fixed-height row sitting in a
// column of other fixed-height rows. Emoji and hard line breaks fight that — an
// emoji inflates the line box it lands in, and a newline burns one of the
// clamped lines on whitespace.
//
// So the card gets a derived view and the sheet keeps the original. Nothing here
// writes anything back: `flattenNote` is pure, and the stored note is never
// modified.
//
// This module used to carry a second, larger export — `derivePreview`, which
// split an announcement's note into a promoted title and a body. It went with
// the announcement card; what is left is the sanitisation both card types
// shared.

/**
 * Strip emoji, flatten every whitespace run to one space, drop leading list
 * furniture, trim.
 *
 * A parcel card prints its note as a trailing clause after a "·", so it has no
 * use for a promoted title. Its note used to render raw, which meant an emoji
 * inflated the line box it landed in and a hard line break burned one of the
 * one-or-two clamped lines on whitespace, both of which throw off the card's
 * line arithmetic.
 */
export function flattenNote(note: string | null | undefined): string {
  return (note ?? "")
    .replace(EMOJI_RE, " ")
    .replace(WHITESPACE_RE, " ")
    .replace(LEADING_MARK_RE, "")
    .trim();
}

/**
 * Emoji and their joining machinery: pictographs, variation selectors, ZWJ,
 * regional-indicator pairs, and the keycap combining mark. Skin-tone and other
 * modifiers are covered by Extended_Pictographic.
 */
const EMOJI_RE =
  /[\p{Extended_Pictographic}\p{Regional_Indicator}]|[\u{FE00}-\u{FE0F}]|\u{20E3}|\u{200D}/gu;

/** Runs of whitespace, including the newlines the card cannot afford. */
const WHITESPACE_RE = /\s+/g;

/**
 * Leading list furniture — "- ", "• ", "1. ", "*" — which authors use for a
 * line-per-item note. Once the newlines are flattened these become litter.
 */
const LEADING_MARK_RE = /^[\s\-–—*•·]+|^\d+[.)]\s*/;
