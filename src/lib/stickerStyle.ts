import { CSSProperties } from "react";
import { PostType } from "../types";

/**
 * The corner sticker every feed card wears — an icon chip now, one icon per
 * post type ("UCHISH" → plane, "POCHTA BOR" → suitcase).
 *
 * One definition for both post types. This lived as a ~15-line object literal
 * copy-pasted into BoardingPass and the announcement card, identical but for
 * the colour lines, and the copies drifted: when the badges lost their
 * rotate() the same edit had to be made twice, in two files, and a miss would
 * have left one post type tilted against the other in the same column. The
 * second call site went with the announcement type; the extraction stays,
 * because this is also what keeps the variants readable side by side.
 *
 * Deliberately NOT tilted. Each type used to carry its own rotate() — -2.5deg
 * for a traveler, +2deg for a request — so a run of cards didn't read as a
 * repeating pattern. That threw the label's baseline off level against the
 * straight rules of the rest of the card, so the stickers are flat and colour
 * alone tells the types apart.
 *
 * In-flow, not absolutely positioned — it used to hang off the card's top edge;
 * this keeps it anchored inside the card at a fixed spot regardless of the
 * label's length ("Uchish" vs "Pochta bor").
 */

/** Geometry and type — identical for every post type, which is the point. */
const STICKER_BASE: CSSProperties = {
  flexShrink: 0,
  fontFamily: "'Space Mono', monospace",
  fontSize: "10.5px",
  letterSpacing: "1px",
  textTransform: "uppercase",
  // Squared up around a lone icon: the labels ("Uchish", "Pochta bor") left the
  // badge carrying copy, so the side padding had to clear two words; with the
  // word gone, that 12px shrank to 8px so the sticker reads as an icon chip.
  padding: "6px 8px",
  borderRadius: 4,
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  boxShadow: "0 3px 8px rgba(27,42,74,0.15)",
};

/**
 * The only per-type difference. The border colour tracks the background rather
 * than being shared: a dark dash reads on gold and vanishes on navy, and a light
 * one does the reverse.
 */
const STICKER_VARIANTS: Record<PostType, CSSProperties> = {
  traveler: {
    border: "1px dashed rgba(255,255,255,0.4)",
    background: "var(--color-blue)",
    color: "var(--color-card)",
  },
  request: {
    border: "1px dashed rgba(255,255,255,0.4)",
    background: "var(--color-red)",
    color: "var(--color-card)",
  },
};

/** Inline style for a post type's sticker. */
export function stickerStyle(type: PostType): CSSProperties {
  return { ...STICKER_BASE, ...STICKER_VARIANTS[type] };
}
