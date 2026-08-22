import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  X,
  Plane,
  Briefcase,
  ArrowRight,
  Check,
  ShieldCheck,
  MapPin,
  Calendar,
  Scale,
  MessageCircle,
  Info,
} from "lucide-react";
import { Locale } from "../types";
import { Explainer } from "../../lib/explainers";
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
 * Extended explanation post.
 * Features touch/finger swipe navigation and a single bottom action button ("Keyingisi" / "Tushundim").
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

  const current = explainers[active]?.content[locale];
  if (!current) return null;

  const isLast = active === explainers.length - 1;

  const handleNextClick = () => {
    if (isLast) {
      onClose();
    } else {
      scrollToSlide(active + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-ink/45 backdrop-blur-[3px] flex items-end justify-center z-[100] animate-[fadein_0.2s_ease]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={current.title}
        tabIndex={-1}
        className="bg-card w-full max-w-[560px] rounded-t-2xl pb-6 max-h-[88vh] flex flex-col shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative outline-none overflow-hidden"
      >
        {/* Navy Header matching Elchi Post Detail Header */}
        <div className="bg-ink text-card px-6 pt-4 pb-7 relative rounded-t-2xl shrink-0">
          <div className="w-10 h-1 bg-white/25 rounded-full mx-auto mb-5" aria-hidden="true" />
          <button
            onClick={onClose}
            aria-label={t.closeLabel || "Yopish"}
            className="absolute right-[18px] top-[16px] bg-white/10 hover:bg-white/20 border-none w-8 h-8 rounded-full flex items-center justify-center text-card transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Badge */}
          <div
            className="font-mono text-[10.5px] uppercase px-3 py-1.5 rounded inline-flex items-center gap-1.5 font-bold"
            style={{
              background: "var(--color-gold)",
              color: "var(--color-ink)",
            }}
          >
            <Info className="w-3.5 h-3.5 text-ink" />
            {current.tag}
          </div>

          {/* Title */}
          <div className="flex items-center gap-3 font-black text-2xl tracking-tight mt-3 text-card">
            <span>{current.title}</span>
          </div>

          {/* Meta line */}
          <div className="font-mono text-xs opacity-70 mt-1.5 tracking-wider">
            {current.routeHub} · {current.subline}
          </div>
        </div>

        {/* Swipeable Post Body Track (supports touch sliding, hidden scrollbars) */}
        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory overflow-x-auto overflow-y-auto overscroll-contain flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {explainers.map((explainer, i) => {
            const c = explainer.content[locale];

            return (
              <div
                key={explainer.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className="min-w-0 flex-[0_0_100%] snap-start px-6 pt-6 pb-4 flex flex-col gap-5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {/* Post Illustration */}
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

                {/* Lead Paragraph */}
                {c.lead && (
                  <div className="text-[14.5px] sm:text-[15px] text-body leading-relaxed">
                    {renderFormattedText(c.lead)}
                  </div>
                )}

                {/* Post 1: Points */}
                {c.points && c.points.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {c.points.map((pt, idx) => (
                      <div
                        key={idx}
                        className="bg-paper rounded-xl p-3.5 flex flex-col gap-1 border border-edge/60"
                      >
                        <div className="font-bold text-[14.5px] text-ink">{pt.title}</div>
                        <div className="text-[13.5px] text-body leading-relaxed">{pt.desc}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Post 2: Types List */}
                {c.typesList && c.typesList.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {c.typesList.map(({ icon, label, text }, idx) => {
                      const conf = TYPE_CONFIG[icon];
                      const IconComp = conf.Icon;
                      return (
                        <div
                          key={idx}
                          className="bg-paper rounded-xl p-3.5 flex items-start gap-3.5 border border-edge/60"
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${conf.text} mt-0.5`}
                            style={{ background: conf.bg }}
                          >
                            <IconComp className="h-4 w-4" />
                          </span>
                          <div className="flex flex-col">
                            <span className="font-bold text-[14.5px] text-ink">{label}</span>
                            <span className="text-[13.5px] text-body leading-relaxed">{text}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Post 2: Action Flow Steps */}
                {c.flowSteps && c.flowSteps.length > 0 && (
                  <div className="bg-paper rounded-xl p-3.5 border border-edge/60 flex flex-col gap-2.5">
                    <div className="font-mono text-[11px] tracking-wider uppercase text-blue font-bold">
                      Asosiy qadamlar
                    </div>
                    <div className="flex flex-col gap-2">
                      {c.flowSteps.map((s, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-[13.5px]">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-card mt-0.5">
                            {s.step}
                          </span>
                          <div className="leading-relaxed text-body">
                            <strong className="text-ink font-bold mr-1">{s.title}:</strong>
                            {s.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Post 3: Tips Cards */}
                {c.tips && c.tips.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    {c.tips.map((tip, idx) => {
                      const IconComp = TIP_ICONS[tip.icon];
                      return (
                        <div
                          key={idx}
                          className="bg-paper rounded-xl p-3.5 flex items-start gap-3.5 border border-edge/60"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/10 text-ink mt-0.5">
                            <IconComp className="h-3.5 w-3.5" />
                          </span>
                          <div className="flex flex-col">
                            <span className="font-bold text-[14px] text-ink">{tip.title}</span>
                            <span className="text-[13px] text-body leading-relaxed">{tip.desc}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Post 4: Bullet list */}
                {c.bullets && c.bullets.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    {c.bullets.map((bullet, idx) => (
                      <div
                        key={idx}
                        className="bg-paper rounded-xl p-3.5 flex items-start gap-3 border border-edge/50 text-[13.5px] text-body leading-relaxed"
                      >
                        <ShieldCheck className="h-4 w-4 shrink-0 text-blue mt-0.5" />
                        <span>{renderFormattedText(bullet)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Post 4: Note */}
                {c.note && (
                  <div className="bg-paper rounded-xl p-3.5 text-[13px] text-body leading-relaxed border border-edge/60">
                    {renderFormattedText(c.note)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Single Primary Action Button at Bottom */}
        <div className="px-6 pt-3 pb-2 border-t border-rule bg-card shrink-0">
          <button
            type="button"
            onClick={handleNextClick}
            className={`w-full py-3 px-4 rounded-xl font-bold text-[14.5px] text-card flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99] cursor-pointer border-none ${
              isLast
                ? "bg-green hover:bg-green-deep"
                : "bg-ink hover:bg-ink/90"
            }`}
          >
            {isLast ? (
              <>
                <Check className="w-4 h-4" />
                Tushundim
              </>
            ) : (
              <>
                Keyingisi
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
