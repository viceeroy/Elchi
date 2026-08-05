import { useLayoutEffect, useRef, useState } from "react";

/**
 * Whether a line-clamped element is actually cutting anything off.
 *
 * Both card types print a "ko'proq" cue under a note that didn't fit, and both
 * need this measured rather than guessed: the clamp is a line count, but how
 * many characters fit on a line depends on the card's width, so a note that
 * prints whole at 1280px is cut at 375px. A character budget can't serve both —
 * it would either waste half the card on the wide layout or hide the cue on the
 * narrow one.
 *
 * Returns a ref to attach to the clamped element and the current verdict.
 * `deps` should be the text being clamped, so the check re-runs when the card
 * is recycled for a different post.
 */
export function useIsClamped<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  const [isClamped, setIsClamped] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      // The clamped element is conditional on both cards (a parcel post need
      // not carry a note at all), so a missing ref means "nothing to cut".
      setIsClamped(false);
      return;
    }
    // The 1px slack absorbs sub-pixel line-height rounding, which otherwise
    // reports a one-line note as overflowing at some zoom levels.
    const measure = () => setIsClamped(el.scrollHeight - el.clientHeight > 1);
    measure();
    // Re-measure on resize: the feed is one column at every width, so a card
    // that fits at 900px can be cut at 375px without the note itself changing.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [dep]);

  return { ref, isClamped };
}
