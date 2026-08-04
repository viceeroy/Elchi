// Card-preview text for an announcement.
//
// The feed and the detail sheet want different things from the same two
// columns. The sheet is the record: it renders `post.note` raw, with
// `whitespace-pre-wrap`, so the author's line breaks and emoji survive exactly
// as typed. The card is an index entry: one clamped title line and three lines
// of prose, in a fixed-height row sitting in a column of other fixed-height
// rows. Emoji and hard line breaks fight that — an emoji inflates the line box
// it lands in, and a newline burns one of the three body lines on whitespace.
//
// So the card gets a derived view and the sheet keeps the original. Nothing
// here writes anything back: `derivePreview` is pure, and the stored note is
// never modified.

/** What the card renders. `title` is null when there is nothing worth leading with. */
export interface PostPreview {
  /** Headline, or a first clause lifted from the note. Null when the note is its own title. */
  title: string | null;
  /** The note as flat, single-spaced prose, minus any text promoted into `title`. */
  body: string;
}

/**
 * Longest derived title. Sized for one clamped line at `text-[17px]` in the
 * card's left column at the narrowest supported width — past this the clamp
 * would cut mid-word anyway, so we cut at a word boundary ourselves.
 */
const TITLE_MAX = 56;

/**
 * A derived title is only worth showing if what remains is a real body. Below
 * this many characters left over, the card would read as a title followed by a
 * fragment, so the note is left whole instead.
 */
const BODY_MIN = 24;

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

/**
 * End of the first clause. The em/en dashes and the colon are in here because
 * "Yuk tashish xizmati — Seul, Toshkent" is a title and a body, not a sentence.
 */
const CLAUSE_END_RE = /[.!?…:；;]|\s[—–]\s/u;

/** Strip emoji, flatten every whitespace run to one space, trim. */
function flatten(text: string): string {
  return text
    .replace(EMOJI_RE, " ")
    .replace(WHITESPACE_RE, " ")
    .replace(LEADING_MARK_RE, "")
    .trim();
}

/**
 * Drop a trailing terminator: "Yuk tashish xizmati." reads as a sentence
 * fragment where "Yuk tashish xizmati" reads as a heading.
 */
function stripTerminator(text: string): string {
  return text.replace(/[\s.!?…:；;—–]+$/u, "");
}

/** Cut at the last word boundary at or before `max`, without a mid-word chop. */
function clipToWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * Build the card's title/body pair.
 *
 * With a headline, that is the title and the whole note is the body. Without
 * one — the common case, since the current composer is a single text box — the
 * note's first clause is promoted to the title and the rest becomes the body,
 * so a long note still leads with something scannable. A note too short to
 * split keeps `title: null` and is rendered whole.
 */
export function derivePreview(
  headline: string | null | undefined,
  note: string | null | undefined,
): PostPreview {
  const flatNote = flatten(note ?? "");
  const flatHeadline = flatten(headline ?? "");

  if (flatHeadline) {
    return { title: clipToWord(flatHeadline, TITLE_MAX), body: flatNote };
  }

  // A hard line break is the strongest title signal there is — an author who
  // put their subject on its own line has already told us what the title is.
  // This is checked before punctuation because the two disagree: a note opening
  // "LPG SPARK SOTILADI\nKomsa qilingan\nYili: 2013" has its first colon three
  // lines in, so clause detection would sweep all three into the title.
  const raw = note ?? "";
  const breakAt = raw.search(/\r?\n/);
  if (breakAt > -1) {
    const head = flatten(raw.slice(0, breakAt));
    const tail = flatten(raw.slice(breakAt));
    if (head && head.length <= TITLE_MAX && tail.length >= BODY_MIN) {
      return { title: stripTerminator(head), body: tail };
    }
  }

  // Where the first clause ends. `search` gives the index of the terminator
  // itself, so the split point is just past it.
  const match = flatNote.match(CLAUSE_END_RE);
  const clauseEnd =
    match?.index !== undefined ? match.index + match[0].length : -1;

  // A clause that runs past TITLE_MAX is not a title, it is the opening of a
  // paragraph — fall back to a word-boundary clip at TITLE_MAX.
  const splitAt =
    clauseEnd > 0 && clauseEnd <= TITLE_MAX
      ? clauseEnd
      : clipToWord(flatNote, TITLE_MAX).length;

  const title = flatNote.slice(0, splitAt).trim();
  const body = flatNote.slice(splitAt).trim();

  // Nothing meaningful left over: the note IS the title, so let it be the body
  // and lead with nothing. This is what keeps "Kontaktsiz elon." from being
  // shown twice.
  if (!title || body.length < BODY_MIN) {
    return { title: null, body: flatNote };
  }

  return { title: stripTerminator(title), body };
}
