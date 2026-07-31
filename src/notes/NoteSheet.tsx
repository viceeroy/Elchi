import React from "react";
import { X, Briefcase, Package, Info } from "lucide-react";
import { Locale } from "../types";
import { Note } from "./data";

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
  const isIntro = note.kind === "intro";
  const isTraveler = note.kind === "traveler";
  const headerBg = isIntro ? "#C23B3B" : "#1B2A4A";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[#1b2a4a]/45 backdrop-blur-[3px] animate-[fadein_0.2s_ease]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={c.title}
        className="relative max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl bg-[#FCFBF6] pb-8 shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)]"
      >
        <div
          className="relative rounded-t-2xl px-6 pt-4 pb-7 text-[#FCFBF6]"
          style={{ background: headerBg }}
        >
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/25" />
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-[18px] top-[16px] flex h-8 w-8 items-center justify-center rounded-full border-none bg-white/10 text-[#FCFBF6] transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>

          <div
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wider"
            style={{
              background: isIntro ? "#F6EFE2" : isTraveler ? "#C79A3E" : "#C23B3B",
              color: isIntro ? "#C23B3B" : "#1B2A4A",
            }}
          >
            {isIntro ? (
              <Info className="h-3.5 w-3.5" />
            ) : isTraveler ? (
              <Briefcase className="h-3.5 w-3.5" />
            ) : (
              <Package className="h-3.5 w-3.5" />
            )}
            {c.tag}
          </div>

          <h2 className="m-0 mt-3 text-2xl font-black tracking-tight">{c.title}</h2>
          {c.meta && (
            <div className="mt-1.5 font-mono text-xs tracking-wider opacity-70">{c.meta}</div>
          )}
        </div>

        <div className="flex flex-col gap-3.5 px-6 pt-6">
          {body.map((paragraph, i) => (
            <p key={i} className="m-0 text-[14.5px] leading-relaxed text-[#3A4256]">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NoteSheet;
