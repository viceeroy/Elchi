import React, { useCallback, useState } from "react";

/**
 * Screen-reader announcements for things that change without a page or focus
 * move.
 *
 * The board does most of its real work asynchronously and silently: the contact
 * reveal swaps a skeleton for a handle, the copy buttons flip an icon to a
 * check, the composer confirms with a toast that appears and dismisses itself.
 * All of that was visual only — a screen-reader user pressed "reveal contact",
 * heard nothing, and had no way to know the handle had arrived. That is the one
 * thing the board exists to do.
 *
 * Two regions rather than one, because the two tones are not interchangeable:
 * `polite` waits for a gap in speech and is right for confirmations, `assertive`
 * interrupts and is reserved for errors the user has to act on. A single polite
 * region would bury failures behind whatever was being read; a single assertive
 * one would talk over the user every time they copied a phone number.
 *
 * Both regions are rendered on mount and stay mounted with empty text. This is
 * the part that is easy to get wrong: a live region only announces content
 * *inserted into a region that already exists*. Conditionally rendering the
 * element together with its message — `{error && <p role="alert">…</p>}` — is
 * the common React shape and it announces unreliably, because the region and
 * the text arrive in the same paint.
 */

interface Announcement {
  text: string;
  // Bumped on every call so that announcing the same string twice still
  // registers as a DOM change. Without it, copying two phone numbers in a row
  // sets identical text, React skips the update, and the second copy is silent.
  seq: number;
}

const EMPTY: Announcement = { text: "", seq: 0 };

// A zero-width space appended on alternating calls. It makes a repeated message
// a genuinely different string for the accessibility tree while reading as
// nothing at all — screen readers skip it, and it cannot affect layout.
const renderText = ({ text, seq }: Announcement) =>
  text ? text + (seq % 2 ? "​" : "") : "";

export function useAnnouncer() {
  const [polite, setPolite] = useState<Announcement>(EMPTY);
  const [assertive, setAssertive] = useState<Announcement>(EMPTY);

  const announce = useCallback((text: string) => {
    setPolite((prev) => ({ text, seq: prev.seq + 1 }));
  }, []);

  const announceError = useCallback((text: string) => {
    setAssertive((prev) => ({ text, seq: prev.seq + 1 }));
  }, []);

  // `aria-atomic` so the whole message is read as a unit rather than only the
  // characters that changed — without it a screen reader may announce the diff
  // between the old and new string, which is gibberish.
  const liveRegions = (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {renderText(polite)}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {renderText(assertive)}
      </div>
    </>
  );

  return { announce, announceError, liveRegions };
}
