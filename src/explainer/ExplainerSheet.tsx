import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  X,
  Plane,
  Briefcase,
  ArrowLeft,
  ArrowRight,
  Check,
  ShieldCheck,
  MapPin,
  Calendar,
  Scale,
  MessageCircle,
} from "lucide-react";
import { Locale } from "../types";
import { Explainer } from "./data";
import { translations } from "../translations";
import { useDialog } from "../hooks/useDialog";

const TYPE_CONFIG = {
  traveler: { Icon: Plane, bg: "var(--color-blue)", text: "text-white" },
  request: { Icon: Briefcase, bg: "var(--color-red)", text: "text-white" },
} as const;

const TIP_ICONS = {
  map: MapPin,
  calendar: Calendar,
  scale: Scale,
  message: MessageCircle,
} as const;

interface ExplainerSheetProps {
  explainers: Explainer[];
  locale: Locale;
  onClose: () => void;
}

const renderFormattedText = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

/**
 * Extended bottom sheet for Elchi explanation posts.
 */
export const ExplainerSheet: React.FC<ExplainerSheetProps> = ({
  explainers,
  locale,
  onClose,
}) => {
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

  const scrollToSlide = (index: number) => {
    const target = itemRefs.current[index];
    if (target && trackRef.current) {
      trackRef.current.scrollTo({
        left: target.offsetLeft,
        behavior: "smooth",
      });
      setActive(index);
    }
  };

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

  const currentPost = explainers[active]?.content[locale];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/45 backdrop-blur-[3px] animate-[fadein_0.2s_ease]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Loyiha haqida"
        tabIndex={-1}
        className="relative flex flex-col w-full max-w-[540px] max-h-[92vh] rounded-t-2xl sm:rounded-2xl bg-card border border-edge shadow-2xl outline-none overflow-hidden animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)]"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-rule/70 bg-card">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-paper px-2.5 py-0.5 font-mono text-[11px] font-bold text-ink border border-edge">
              {currentPost?.tag || "Yo‘riqnoma"}
            </span>
            <span className="font-mono text-[12px] font-semibold text-faint">
              {active + 1} / {explainers.length}
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label={t.closeLabel || "Yopish"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink transition-colors hover:bg-ink/10 cursor-pointer border-none p-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable / Swipeable Content Area */}
        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory overflow-x-auto overflow-y-auto overscroll-contain pb-4 pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-h-[calc(92vh-120px)]"
        >
          {explainers.map((explainer, i) => {
            const c = explainer.content[locale];

            return (
              <div
                key={explainer.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className="min-w-0 flex-[0_0_100%] snap-start px-6 flex flex-col gap-3.5"
              >
                {/* 16:9 Illustration */}
                {c.image && (
                  <div className="w-full aspect-[16/9] rounded-xl overflow-hidden bg-paper ring-1 ring-ink/5 shadow-xs shrink-0">
                    <img
                      src={c.image}
                      alt=""
                      loading="eager"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Title */}
                <h3 className="m-0 text-xl sm:text-2xl font-black tracking-tight text-ink">
                  {c.title}
                </h3>

                {/* Lead Text */}
                {c.lead && (
                  <p className="m-0 text-[14.5px] leading-relaxed text-[#3A4256]">
                    {renderFormattedText(c.lead)}
                  </p>
                )}

                {/* Post 1: Points cards */}
                {c.points && c.points.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    {c.points.map((pt, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl bg-paper/90 p-3.5 border border-edge/70 flex flex-col gap-1"
                      >
                        <span className="font-bold text-[14px] text-ink">
                          {pt.title}
                        </span>
                        <span className="text-[13px] text-[#4A5268] leading-relaxed">
                          {pt.desc}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Post 2: Types List */}
                {c.typesList && c.typesList.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    {c.typesList.map(({ icon, label, text }, idx) => {
                      const conf = TYPE_CONFIG[icon];
                      const IconComp = conf.Icon;
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-3 rounded-xl bg-paper/90 p-3.5 border border-edge/70"
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${conf.text} mt-0.5`}
                            style={{ background: conf.bg }}
                          >
                            <IconComp className="h-4 w-4" />
                          </span>
                          <div className="flex flex-col">
                            <span className="font-bold text-[14px] text-ink">
                              {label}
                            </span>
                            <span className="text-[13px] text-[#4A5268] leading-relaxed">
                              {text}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Post 2: Action Flow Steps */}
                {c.flowSteps && c.flowSteps.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-xl bg-paper/80 p-3.5 border border-edge/70">
                    <span className="font-bold text-[13px] text-ink">
                      Asosiy qadamlar:
                    </span>
                    <div className="flex flex-col gap-2">
                      {c.flowSteps.map((s, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-[13px]">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-card mt-0.5">
                            {s.step}
                          </span>
                          <div className="leading-snug text-[#3A4256]">
                            <strong className="text-ink font-bold mr-1">{s.title}:</strong>
                            {s.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Post 3: Detail Tips Cards */}
                {c.tips && c.tips.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {c.tips.map((tip, idx) => {
                      const IconComp = TIP_ICONS[tip.icon];
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-3 rounded-xl bg-paper/90 p-3 border border-edge/70"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/10 text-ink mt-0.5">
                            <IconComp className="h-3.5 w-3.5" />
                          </span>
                          <div className="flex flex-col">
                            <span className="font-bold text-[13.5px] text-ink">
                              {tip.title}
                            </span>
                            <span className="text-[12.5px] text-[#4A5268] leading-snug">
                              {tip.desc}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Post 4: Bullet list */}
                {c.bullets && c.bullets.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {c.bullets.map((bullet, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 rounded-lg bg-paper/80 p-2.5 sm:p-3 border border-edge/50 text-[13px] sm:text-[13.5px] text-[#3A4256] leading-relaxed"
                      >
                        <ShieldCheck className="h-4 w-4 shrink-0 text-blue mt-0.5" />
                        <span>{renderFormattedText(bullet)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Post 4: Final note */}
                {c.note && (
                  <div className="rounded-xl bg-paper/90 p-3 text-[12.5px] text-[#4A5268] leading-relaxed border border-edge/60">
                    {renderFormattedText(c.note)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Navigation Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-rule/70 bg-card">
          {active > 0 ? (
            <button
              type="button"
              onClick={() => scrollToSlide(active - 1)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13.5px] font-bold text-ink transition-colors hover:bg-ink/5 cursor-pointer border-none bg-transparent"
            >
              <ArrowLeft className="h-4 w-4" />
              Oldingi
            </button>
          ) : (
            <div className="w-16" />
          )}

          {/* Dots Indicator */}
          <div className="flex gap-1.5" aria-hidden="true">
            {explainers.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToSlide(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer border-none p-0 ${
                  i === active ? "w-5 bg-ink" : "w-1.5 bg-ink/20 hover:bg-ink/40"
                }`}
              />
            ))}
          </div>

          {active < explainers.length - 1 ? (
            <button
              type="button"
              onClick={() => scrollToSlide(active + 1)}
              className="flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-[13.5px] font-bold text-card transition-colors hover:bg-ink/90 cursor-pointer border-none shadow-xs"
            >
              Keyingi
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-xl bg-green px-4 py-2 text-[13.5px] font-bold text-card transition-colors hover:bg-green-deep cursor-pointer border-none shadow-xs"
            >
              <Check className="h-4 w-4" />
              Tugatish
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
