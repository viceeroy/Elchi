import React, { useRef, useState, useCallback, useEffect } from "react";
import { X, Plane, Briefcase, Info } from "lucide-react";
import { Locale } from "../types";
import { Explainer } from "./data";
import { translations } from "../translations";
import { useDialog } from "../hooks/useDialog";

const TYPE_ICON = {
  traveler: { Icon: Plane, bg: "var(--color-gold)" },
  request: { Icon: Briefcase, bg: "var(--color-red)" },
} as const;

interface ExplainerSheetProps {
  explainers: Explainer[];
  locale: Locale;
  onClose: () => void;
}

/**
 * Expanded view for board notes. Mirrors the post detail sheet (same backdrop,
 * slide-up and header treatment) so the two read as one surface — but it holds
 * only static copy: there is no author, no contact and nothing to fetch.
 */
export const ExplainerSheet: React.FC<ExplainerSheetProps> = ({ explainers, locale, onClose }) => {
  // This sheet takes a locale rather than a `t` bundle — it renders static
  // editorial copy, not API data — so it reaches the string table directly for
  // the one label it needs. Still not a hardcoded Uzbek literal in a component.
  const t = translations[locale];
  const panelRef = useDialog<HTMLDivElement>(onClose);

  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/45 backdrop-blur-[3px] animate-[fadein_0.2s_ease]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Loyiha haqida"
        tabIndex={-1}
        className="relative max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl bg-card pb-8 shadow-2xl outline-none animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)]"
      >
        <div className="relative rounded-t-2xl bg-red px-6 pt-4 pb-7 text-card">
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
          <button
            onClick={onClose}
            aria-label={t.closeLabel || "Yopish"}
            className="absolute right-[18px] top-[16px] flex h-8 w-8 items-center justify-center rounded-full border-none bg-white/10 text-card transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="inline-flex items-center gap-1.5 rounded bg-[#F6EFE2] px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-red">
            <Info className="h-3.5 w-3.5" />
            Loyiha haqida
          </div>

          <h2 className="m-0 mt-3 text-2xl font-black tracking-tight">Elchi nima?</h2>
        </div>

        {/* Dots indicator */}
        {explainers.length > 1 && (
          <div className="flex justify-center gap-1.5 pt-6 pb-2" aria-hidden="true">
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

        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-8 pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {explainers.map((explainer, i) => {
            const c = explainer.content[locale];
            const body = c.detail && c.detail.length > 0 ? c.detail : [c.summary];
            return (
              <div 
                key={explainer.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className="min-w-0 flex-[0_0_100%] snap-start px-6 flex flex-col gap-3.5"
              >
                <h3 className="m-0 text-xl font-bold tracking-tight text-ink mb-1">{c.title}</h3>
                {c.image && (
                  <img
                    src={c.image}
                    alt=""
                    loading="lazy"
                    className="w-full aspect-[16/9] rounded-xl mb-1 object-cover shadow-sm ring-1 ring-ink/5"
                  />
                )}
                {body[0] && (
                  <p className="m-0 text-[14.5px] leading-relaxed text-[#3A4256]">{body[0]}</p>
                )}

                {c.typesList && c.typesList.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    {c.typesList.map(({ icon, text }, idx) => {
                      const { Icon, bg } = TYPE_ICON[icon];
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-3 rounded-lg bg-paper p-3"
                        >
                          <span
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-ink"
                            style={{ background: bg }}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <p className="m-0 text-[13.5px] leading-relaxed text-[#3A4256]">{text}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {body.slice(1).map((paragraph, idx) => (
                  <p key={idx} className="m-0 text-[14.5px] leading-relaxed text-[#3A4256]">
                    {paragraph}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
