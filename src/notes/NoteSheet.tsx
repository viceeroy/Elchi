import React from "react";
import { X, Plane, Briefcase, Info, Megaphone } from "lucide-react";
import { Locale } from "../types";
import { Note } from "./data";
import { translations } from "../translations";
import { useDialog } from "../hooks/useDialog";

const TYPE_ICON = {
  traveler: { Icon: Plane, bg: "var(--color-gold)" },
  request: { Icon: Briefcase, bg: "var(--color-red)" },
  note: { Icon: Megaphone, bg: "var(--color-gold)" },
} as const;

interface NoteSheetProps {
  note: Note;
  locale: Locale;
  onClose: () => void;
}

/**
 * Expanded view for a board note. Mirrors the post detail sheet (same backdrop,
 * slide-up and header treatment) so the two read as one surface — but it holds
 * only static copy: there is no author, no contact and nothing to fetch.
 */
export const NoteSheet: React.FC<NoteSheetProps> = ({ note, locale, onClose }) => {
  const c = note.content[locale];
  const body = c.detail && c.detail.length > 0 ? c.detail : [c.summary];
  // This sheet takes a locale rather than a `t` bundle — it renders static
  // editorial copy, not API data — so it reaches the string table directly for
  // the one label it needs. Still not a hardcoded Uzbek literal in a component.
  const t = translations[locale];
  const panelRef = useDialog<HTMLDivElement>(onClose);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/45 backdrop-blur-[3px] animate-[fadein_0.2s_ease]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={c.title}
        tabIndex={-1}
        className="relative max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl bg-card pb-8 shadow-2xl outline-none animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)]"
      >
        <div
          className="relative rounded-t-2xl bg-red px-6 pt-4 pb-7 text-card"
        >
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
          <button
            onClick={onClose}
            aria-label={t.closeLabel || "Yopish"}
            className="absolute right-[18px] top-[16px] flex h-8 w-8 items-center justify-center rounded-full border-none bg-white/10 text-card transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>

          <div
            className="inline-flex items-center gap-1.5 rounded bg-[#F6EFE2] px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-red"
          >
            <Info className="h-3.5 w-3.5" />
            {c.tag}
          </div>

          <h2 className="m-0 mt-3 text-2xl font-black tracking-tight">{c.title}</h2>
          {c.meta && (
            <div className="mt-1.5 font-mono text-xs tracking-wider opacity-70">{c.meta}</div>
          )}
        </div>

        <div className="flex flex-col gap-3.5 px-6 pt-6">
          {body[0] && (
            <p className="m-0 text-[14.5px] leading-relaxed text-[#3A4256]">{body[0]}</p>
          )}

          {c.typesList && c.typesList.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {c.typesList.map(({ icon, text }, i) => {
                const { Icon, bg } = TYPE_ICON[icon];
                return (
                  <div
                    key={i}
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

          {body.slice(1).map((paragraph, i) => (
            <p key={i} className="m-0 text-[14.5px] leading-relaxed text-[#3A4256]">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};
