import React from "react";
import { X } from "lucide-react";
import { Locale } from "../types";
import { Note } from "./data";

interface NoteCardProps {
  note: Note;
  locale: Locale;
  onOpen: () => void;
  onDismiss?: () => void;
}

/**
 * The board's intro note — the solid brick-red card with the postmark, which
 * opens the expanded sheet on tap. Only one kind of note is left (see
 * NoteKind in ./data), so this component no longer branches.
 */
export const NoteCard: React.FC<NoteCardProps> = ({ note, locale, onOpen, onDismiss }) => {
  const c = note.content[locale];

  return (
    <article
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      id={`note-card-${note.id}`}
      className="relative h-full overflow-hidden rounded-xl bg-[#C23B3B] text-[#F6EFE2] cursor-pointer shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
      style={{ boxShadow: "0 1px 2px rgba(27,42,74,0.06), 0 10px 28px -18px rgba(27,42,74,0.28)" }}
    >
      {/* Airmail stripe along the top edge, matching the page header */}
      <div className="h-2 bg-[repeating-linear-gradient(-45deg,#C23B3B_0_12px,#FCFBF6_12px_17px,#2A4B8D_17px_29px,#FCFBF6_29px_34px)]" />

      {onDismiss && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label="Dismiss"
          className="absolute right-3 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full border-none bg-white/15 text-[#F6EFE2] transition-colors hover:bg-white/25"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Right padding keeps the copy clear of the postmark, which sits in
          the bottom-right corner at every width. */}
      <div className="px-5 pt-4 pb-5 pr-[92px] sm:px-6 sm:pr-[100px]">
        <div className="font-mono text-[10.5px] uppercase tracking-[1.5px] text-[#F6EFE2]/75">
          {c.tag}
        </div>
        <h3 className="m-0 mt-1.5 text-[22px] font-extrabold tracking-tight text-[#FCFBF6]">
          {c.title}
        </h3>
        <p className="m-0 mt-2 text-[14px] leading-relaxed text-[#F6EFE2]/90">
          {c.summary}
        </p>
      </div>

      {/* Postmark — a lightened tint of the site navy (#2A4B8D). The navy
          itself goes near-invisible on the brick red, so the stamp is raised
          far enough to read while staying in the same blue family as the
          airmail stripe. */}
      <div
        className="pointer-events-none absolute bottom-3 right-4 flex h-[68px] w-[68px] rotate-[-12deg] items-center justify-center rounded-full text-[#8FB2E8]"
        style={{ border: "1.5px solid currentColor" }}
        aria-hidden="true"
      >
        <span className="font-mono text-[10px] font-bold uppercase tracking-[2px]">
          Elchi
        </span>
      </div>
    </article>
  );
};
