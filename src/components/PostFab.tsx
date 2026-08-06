import React, { useEffect } from "react";
import { Plus, Plane, Briefcase, Megaphone } from "lucide-react";
import { Translations } from "../types";

interface PostFabProps {
  t: Translations;
  open: boolean;
  onToggle: (open: boolean) => void;
  onPickTraveler: () => void;
  onPickRequest: () => void;
  onPickNote: () => void;
}

/**
 * The composer speed dial — a single "+" pinned to the bottom-right corner
 * that fans out into the three things a user can post: the two sides of a
 * parcel ad (a traveler offering free luggage space, a sender who needs
 * something carried), and a note.
 *
 * The two parcel sides open the same form and the dial only preselects which
 * side of it; the note opens its own, far shorter sheet. Asking here rather
 * than inside the form means the user states their intent once, with the same
 * blue/red/gold colour coding the feed already uses for the three stamps, so
 * the choice reads the same while composing as when browsing.
 */
export const PostFab: React.FC<PostFabProps> = ({
  t,
  open,
  onToggle,
  onPickTraveler,
  onPickRequest,
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
      key: "traveler",
      // The same three lucide marks the feed and the detail sheet use for the
      // three post types, so an icon means one thing across the whole board.
      Icon: Plane,
      label: t.fabTravelerLabel || "Uchish",
      // Blue, red and gold exactly as the traveler/request/note stamps on the
      // cards (see BoardingPass, AnnouncementCard), so the dial is
      // colour-readable before the label is, and tilted alternating ways.
      color: "var(--color-blue)",
      textColor: "var(--color-card)",
      tilt: "rotate(-2.5deg)",
      onPick: onPickTraveler,
    },
    {
      key: "request",
      Icon: Briefcase,
      label: t.fabRequestLabel || "Pochta",
      color: "var(--color-red)",
      textColor: "var(--color-card)",
      tilt: "rotate(2deg)",
      onPick: onPickRequest,
    },
    {
      key: "note",
      Icon: Megaphone,
      // Gold carries dark text — the stamp colour is light enough that the
      // cream used on the other two would not hold contrast.
      label: t.fabNoteLabel || "E'lon",
      color: "var(--color-gold)",
      textColor: "var(--color-ink)",
      tilt: "rotate(-2deg)",
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
          className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] animate-[fadein_0.16s_ease]"
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
              {/* Label wears the post-card sticker: mono caps on the stamp
                  colour, dashed airmail edge, tilted off-square. */}
              <span
                style={{
                  fontFamily: "'Space Mono', monospace",
                  background: opt.color,
                  color: opt.textColor,
                  transform: opt.tilt,
                }}
                className="rounded px-3 py-1.5 shadow-lg border border-dashed border-white/40 text-[10.5px] font-bold uppercase tracking-[1px] leading-tight"
              >
                {opt.label}
              </span>
              {/* Solid disc in the type's stamp colour, carrying the type's
                  icon — the same badge the board note's explainer uses, so the
                  three kinds look identical wherever they are listed. */}
              <span
                style={{ background: opt.color, color: opt.textColor }}
                className="w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-105"
              >
                <opt.Icon className="w-5 h-5" aria-hidden="true" />
              </span>
            </button>
          ))}

        <button
          type="button"
          onClick={() => onToggle(!open)}
          aria-expanded={open}
          aria-label={open ? t.fabCloseLabel || "Close" : t.fabOpenLabel || "Post an ad"}
          className="w-14 h-14 rounded-full bg-ink text-gold border-none flex items-center justify-center shadow-lg cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all"
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
