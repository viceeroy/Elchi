import { useEffect, useRef } from "react";

/**
 * Focus management for the board's bottom sheets.
 *
 * Every overlay in the app — the post detail sheet, the note sheet, login,
 * profile and both composers — used to be a bare `<div>` over a backdrop whose
 * only dismissal was a click on the scrim. That is mouse-only. A keyboard user
 * who opened a sheet kept focus on the card behind it, had to Tab forward
 * through the whole feed to reach the sheet's own controls, could Tab straight
 * back out into the page underneath, and had no Escape. A screen reader was
 * never told a dialog had opened at all.
 *
 * This hook is the one place that is fixed, rather than five copies of the same
 * effect. It gives the element it is attached to:
 *
 *   - focus on open, and the previously focused element back on close
 *   - Escape to dismiss
 *   - a Tab trap, so focus cannot leave the panel while it is up
 *
 * Scroll locking is deliberately NOT here. App already locks the background
 * with `position: fixed` on <body>, which also stops touch gestures dragging
 * the feed under the sheet; a second `overflow: hidden` lock in this hook would
 * be a competing mechanism restoring the same element from two places.
 *
 * The caller still owns the markup: attach `ref` to the panel, give it
 * `tabIndex={-1}` so it can take focus, and label it with `role="dialog"`,
 * `aria-modal="true"` and an `aria-label`/`aria-labelledby`. The hook cannot add
 * those itself, and a panel without them is announced as an unlabelled group.
 *
 * `active` exists for the one caller that cannot mount/unmount a component —
 * the detail sheet is inline JSX inside App, so its hook has to be called on
 * every render and told when the sheet is actually up.
 */

// Only the topmost dialog may act on Escape. Login opens *over* the detail
// sheet, and both listen on the document, so without this a single Escape would
// collapse the whole stack instead of stepping back one level. A ref cell per
// hook instance is pushed on open and popped on close; identity is all that
// matters, so the cell's contents are never read.
const dialogStack: object[] = [];

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useDialog<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
  active = true,
) {
  const panelRef = useRef<T>(null);

  // onClose is usually an inline arrow, so a new function identity arrives on
  // every render. Reading it through a ref keeps the effect below keyed on
  // `active` alone — otherwise the whole dialog would tear down and re-open
  // (stealing focus back to the panel) on every parent re-render, which for the
  // detail sheet means every keystroke in the contact area.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    if (!panel) return;

    const token = {};
    dialogStack.push(token);

    // Captured before we move focus, and deliberately the *element*, not a
    // selector: the card that opened the sheet is still in the DOM behind it,
    // so this restores the user to the exact spot in the feed they left.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the panel itself rather than its first control. A screen reader
    // then reads the dialog's label and role before its contents, which is the
    // orientation the user is missing; jumping straight to the first button
    // announces the button alone and loses the fact that anything opened.
    panel.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dialogStack[dialogStack.length - 1] !== token) return;
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key !== "Tab") return;
      // The trap only governs its own panel. The stack is not consulted here:
      // the sheets are siblings in the DOM, not nested, so a keydown inside the
      // top panel never reaches a lower one's handler anyway.
      if (!panel.contains(e.target as Node)) return;

      // Recomputed on every Tab, not cached on open: the composers add and
      // remove fields (the second contact row, the error block) while they are
      // open, and a stale list would trap focus against a control that is gone.
      // `offsetParent` filters out anything display:none — a cheap check that is
      // enough here because nothing in these sheets is hidden by visibility
      // alone.
      const focusable: HTMLElement[] = Array.from(
        panel.querySelectorAll(FOCUSABLE) as NodeListOf<HTMLElement>,
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) {
        // Nothing to cycle through — hold focus on the panel rather than
        // letting Tab escape into the page behind.
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // The panel itself is focused on open and is not in `focusable` (it is
      // tabIndex -1), so the forward wrap has to catch it explicitly or the
      // first Tab out of the panel would land outside the sheet.
      if (!e.shiftKey && (e.target === last || e.target === panel)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (e.target === first || e.target === panel)) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);

      const i = dialogStack.indexOf(token);
      if (i !== -1) dialogStack.splice(i, 1);

      // Only restore if the element is still around and still focusable — a
      // composer that closes because its post was created has often outlived
      // the card that opened it.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return panelRef;
}
