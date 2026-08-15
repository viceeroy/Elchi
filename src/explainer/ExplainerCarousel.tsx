import React, { useCallback, useEffect, useRef, useState } from "react";
import { Locale } from "../types";
import { Explainer, EXPLAINERS } from "./data";
import { ExplainerCard } from "./ExplainerCard";

interface ExplainerCarouselProps {
  locale: Locale;
  /** Lifted to the page so the open sheet can share the body scroll lock. */
  onOpenExplainer: (explainer: Explainer) => void;
  explainers?: Explainer[];
}

const DISMISSED_KEY = "elchi_dismissed_notes";

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * Horizontally scrollable row of board notes.
 *
 * Layout is CSS scroll-snap, one full-width card at a time. Small chevrons on
 * the card's edges are the only "there's more" affordance — purely visual, no
 * click handler — and appear on whichever side still has a card to swipe to
 * (right chevron while not on the last note, left chevron once scrolled past
 * the first).
 */
export const ExplainerCarousel: React.FC<ExplainerCarouselProps> = ({
  locale,
  onOpenExplainer,
  explainers: allExplainers = EXPLAINERS,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  // Dismissing a card is local and permanent — it's editorial chrome, not
  // content the user would ever want back, so there's no undo.
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());
  const explainers = allExplainers.filter((n) => !dismissed.has(n.id));

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      } catch {
        // Storage unavailable (private mode, quota) — dismissal still holds
        // for this session via state.
      }
      return next;
    });
  };

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
  }, [syncActive, explainers.length]);

  if (explainers.length === 0) return null;

  return (
    <section aria-label="Board notes" className="relative mb-4">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {explainers.map((explainer, i) => (
          <div
            key={explainer.id}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            // Full width at every breakpoint so a note lines up with the post
            // cards it now sits above.
            className="min-w-0 flex-[0_0_100%] snap-start"
          >
            <ExplainerCard
              explainer={explainer}
              locale={locale}
              onOpen={() => onOpenExplainer(explainer)}
              onDismiss={() => dismiss(explainer.id)}
            />
          </div>
        ))}
      </div>

      {explainers.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
          {explainers.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-4 bg-ink/50" : "w-1.5 bg-ink/15"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};
