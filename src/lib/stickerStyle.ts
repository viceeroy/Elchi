import { CSSProperties } from "react";
import { PostType } from "../types";

/**
 * The corner sticker every feed card wears — an icon chip now, one icon per
 * post type ("YO'LOVCHI" → plane, "JO'NATMA" → suitcase).
 *
 * One definition for both post types. This lived as a ~15-line object literal
 * copy-pasted into PostCard and the announcement card, identical but for
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
 * label's length ("Yo'lovchi" vs "Jo'natma").
 */

/** Geometry and type — identical for every post type, which is the point. */
const STICKER_BASE: CSSProperties = {
  flexShrink: 0,
  fontFamily: "'Space Mono', monospace",
  fontSize: "10.5px",
  letterSpacing: "1px",
  textTransform: "uppercase",
  // Squared up around a lone icon: the labels ("Yo'lovchi", "Jo'natma") left the
  // badge carrying copy, so the side padding had to clear two words; with the
  // word gone, that 12px shrank to 8px so the sticker reads as an icon chip.
  padding: "6px 8px",
  borderRadius: 4,
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  // Was the literal rgba(27,42,74,0.15) — ink's own rgb() triple with alpha
  // baked in by hand. color-mix expresses the same value off --color-ink
  // instead of a second, driftable copy of it; if ink ever moves, this moves
  // with it. Same technique Tailwind's own opacity utilities already compile
  // to elsewhere in this app (e.g. bg-ink/30), so it isn't a new dependency.
  boxShadow: "0 3px 8px color-mix(in srgb, var(--color-ink) 15%, transparent)",
};

/**
 * The only per-type difference. The border colour tracks the background rather
 * than being shared: a dark dash reads on gold and vanishes on navy, and a light
 * one does the reverse.
 */
const STICKER_VARIANTS: Record<PostType, CSSProperties> = {
  traveler: {
    // Was the literal rgba(255,255,255,0.4). No token in the palette is
    // plain white — the closest is --color-card (#FCFBF6, near-white by
    // design) — so this reads as "card, translucent" rather than a raw
    // white nobody named. Same color-mix technique as the shadow above.
    border: "1px dashed color-mix(in srgb, var(--color-card) 40%, transparent)",
    background: "var(--color-blue)",
    color: "var(--color-card)",
  },
  request: {
    border: "1px dashed color-mix(in srgb, var(--color-card) 40%, transparent)",
    background: "var(--color-red)",
    color: "var(--color-card)",
  },
};

/** Inline style for a post type's sticker. */
export function stickerStyle(type: PostType): CSSProperties {
  return { ...STICKER_BASE, ...STICKER_VARIANTS[type] };
}
