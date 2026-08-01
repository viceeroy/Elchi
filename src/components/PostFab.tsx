import React, { useEffect } from "react";
import { Plus, Package, StickyNote } from "lucide-react";
import { Translations } from "../types";

interface PostFabProps {
  t: Translations;
  open: boolean;
  onToggle: (open: boolean) => void;
  onPickParcel: () => void;
  onPickNote: () => void;
}

/**
 * The composer speed dial — a single "+" pinned to the bottom-right corner
 * that fans out into the two things a user can post: a parcel ad (the
 * traveler/request form) and a plain note.
 *
 * The two options are deliberately different objects, not two tabs of one
 * form: a parcel ad carries a date and cargo, a note carries neither. The
 * choice is therefore made here, before either form opens, rather than inside
 * a form the user would have to back out of.
 */
export const PostFab: React.FC<PostFabProps> = ({
  t,
  open,
  onToggle,
  onPickParcel,
  onPickNote,
}) => {
  // Escape closes the dial. The options are focusable buttons, so a keyboard
  // user who fans it open needs a way out that isn't a mouse click on the
  // scrim.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggle(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onToggle]);

  const options = [
    {
      key: "parcel",
      icon: <Package className="w-5 h-5" />,
      label: t.fabParcelLabel || "Parcel",
      // Navy — the same family as the traveler stamp on the post cards.
      swatch: "bg-[#1B2A4A] text-[#FCFBF6]",
      onPick: onPickParcel,
    },
    {
      key: "note",
      icon: <StickyNote className="w-5 h-5" />,
      label: t.fabNoteLabel || "Note",
      // Gold — distinct from both post stamps, since a note is neither.
      swatch: "bg-[#C79A3E] text-[#1B2A4A]",
      onPick: onPickNote,
    },
  ];

  return (
    <>
      {/* Scrim. Dimmer than the modal backdrop: the feed behind stays legible
          because the dial is a menu, not a sheet the user has committed to. */}
      {open && (
        <div
          onClick={() => onToggle(false)}
          className="fixed inset-0 z-40 bg-[#1b2a4a]/30 backdrop-blur-[2px] animate-[fadein_0.16s_ease]"
          aria-hidden="true"
        />
      )}

      <div className="fixed bottom-6 right-5 z-50 flex flex-col items-end gap-3">
        {open &&
          options.map((opt, i) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                onToggle(false);
                opt.onPick();
              }}
              aria-label={opt.label}
              // Staggered so the two rows read as one gesture unfolding
              // outward from the "+" rather than as two things appearing.
              style={{ animationDelay: `${i * 45}ms`, animationFillMode: "backwards" }}
              className="flex items-center gap-3 animate-[fabin_0.22s_cubic-bezier(0.2,0.8,0.2,1)] group"
            >
              <span className="rounded-lg bg-[#FCFBF6] px-3.5 py-2 shadow-lg border border-[#E9E5D8] font-bold text-sm text-[#1B2A4A] leading-tight">
                {opt.label}
              </span>
              <span
                className={`w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 ${opt.swatch}`}
              >
                {opt.icon}
              </span>
            </button>
          ))}

        <button
          type="button"
          onClick={() => onToggle(!open)}
          aria-expanded={open}
          aria-label={open ? t.fabCloseLabel || "Close" : t.fabOpenLabel || "Post an ad"}
          className="w-14 h-14 rounded-full bg-[#1B2A4A] text-[#C79A3E] border-none flex items-center justify-center shadow-lg cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          <Plus
            className={`w-7 h-7 transition-transform duration-200 ${open ? "rotate-45" : ""}`}
            strokeWidth={2.75}
          />
        </button>
      </div>
    </>
  );
};

export default PostFab;
