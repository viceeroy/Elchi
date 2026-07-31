import React, { useCallback, useEffect, useRef, useState } from "react";
import { Locale } from "../types";
import { Note, NOTES } from "./data";
import { NoteCard } from "./NoteCard";

interface NotesCarouselProps {
  locale: Locale;
  /** Lifted to the page so the open sheet can share the body scroll lock. */
  onOpenNote: (note: Note) => void;
  notes?: Note[];
}

/**
 * Horizontally scrollable row of board notes.
 *
 * Layout is CSS scroll-snap: one card per viewport on mobile, and 80% of the
 * track from `sm` up so the next card peeks in at ~20% and the row reads as
 * scrollable without a visible scrollbar. The dots below are driven by, and
 * drive, the same scroll position.
 */
export const NotesCarousel: React.FC<NotesCarouselProps> = ({
  locale,
  onOpenNote,
  notes = NOTES,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);

  // Nearest card to the track's left edge wins — same rule scroll-snap uses,
  // so the dots never disagree with where the snap lands.
  const syncActive = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    let nearest = 0;
    let best = Infinity;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const dist = Math.abs(el.offsetLeft - track.scrollLeft);
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    });
    setActive(nearest);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        syncActive();
      });
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    syncActive();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      track.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [syncActive, notes.length]);

  const scrollToIndex = (i: number) => {
    const track = trackRef.current;
    const el = itemRefs.current[i];
    if (!track || !el) return;
    track.scrollTo({ left: el.offsetLeft, behavior: "smooth" });
    setActive(i);
  };

  if (notes.length === 0) return null;

  return (
    <section aria-label="Board notes" className="mb-6">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {notes.map((note, i) => (
          <div
            key={note.id}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            // Full width on mobile; 80% of the track from `sm` up, which leaves
            // the following card visible as a ~20% sliver.
            className="min-w-0 flex-[0_0_100%] snap-start sm:flex-[0_0_80%]"
          >
            <NoteCard note={note} locale={locale} onOpen={() => onOpenNote(note)} />
          </div>
        ))}
      </div>

      {notes.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {notes.map((note, i) => (
            <button
              key={note.id}
              type="button"
              onClick={() => scrollToIndex(i)}
              aria-label={`${note.content[locale].title}`}
              aria-current={i === active}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === active ? "w-5 bg-[#C23B3B]" : "w-2 bg-[#D8D3C4] hover:bg-[#B9B3A3]"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default NotesCarousel;
