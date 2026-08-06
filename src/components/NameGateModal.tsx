import React, { useState } from "react";
import { Translations } from "../types";
import { supabaseBrowser } from "../supabaseClient";
import { useDialog } from "../hooks/useDialog";
import {
  DISPLAY_NAME_MAX,
  isValidDisplayName,
  normalizeDisplayName,
} from "../../lib/profileName";

interface NameGateModalProps {
  t: Translations;
  userId: string;
  /** Called with the stored (normalized) name once the write lands. */
  onSaved: (displayName: string) => void;
}

/**
 * The one blocking step in the app: a logged-in user with no `display_name`
 * cannot browse or post until they give one.
 *
 * Deliberately not dismissible, and that is the whole point of it — there is no
 * ✕, no backdrop click and no Escape (useDialog is handed a no-op so the focus
 * trap and the Tab cycle still work, but the key does nothing). The only ways
 * out are saving a name or signing out, because a name is now printed on every
 * card the user posts and there is no edit UI to add one later.
 *
 * It fires on *login*, not on signup: every account that predates this gate has
 * a NULL display_name, so the check has to run each time a session appears and
 * simply pass silently once the column is filled. See the profile-name effect
 * in App.tsx for where that check lives.
 *
 * The write goes straight to `profiles` through PostgREST under the own-row
 * UPDATE policy — the API is not in this path — so the validation here is
 * inline feedback only. `profiles_display_name_check` in the schema is the
 * boundary that actually holds, and the catch below is what a rejection from it
 * surfaces as.
 */
export const NameGateModal: React.FC<NameGateModalProps> = ({
  t,
  userId,
  onSaved,
}) => {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // No-op: the gate has no dismissal. The hook is here for the focus trap.
  const panelRef = useDialog<HTMLDivElement>(() => {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const name = normalizeDisplayName(value);
    if (!isValidDisplayName(name)) {
      setError(t.nameGateErrorInvalid || t.errorGeneral);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // `.select()` is not decoration — it is the only way this write can be
      // checked. Without it PostgREST answers a PATCH with `Prefer:
      // return=minimal`, and a PATCH that matches ZERO rows is a 204 with an
      // empty body and no error at all. That is indistinguishable from success
      // here, and it is what actually happened: an account with no `profiles`
      // row (every account predating the 2026-07-22 trigger had none) sailed
      // through this block, closed the gate, and was asked again on the next
      // reload because nothing had been stored. Asking for the row back turns
      // "changed nothing" into a value we can test.
      const { data, error: updateError } = await supabaseBrowser
        .from("profiles")
        .update({ display_name: name })
        .eq("id", userId)
        .select("display_name")
        .maybeSingle();
      if (updateError) throw updateError;
      // No row came back: the write matched nothing. Never report that as saved.
      if (!data) throw new Error(`profiles row missing for ${userId}`);
      onSaved(name);
    } catch (err) {
      console.error("Error saving display name:", err);
      // Generic on purpose — a PostgREST error carries constraint names.
      setError(t.errorGeneral);
      setSaving(false);
    }
  };

  return (
    /* No onClick on the scrim, unlike every other sheet in the app. */
    <div className="fixed inset-0 bg-ink/45 backdrop-blur-[3px] flex items-end justify-center z-[110] animate-[fadein_0.2s_ease]">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-gate-title"
        tabIndex={-1}
        className="bg-card w-full max-w-[560px] rounded-t-2xl px-6 pt-4 pb-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative outline-none"
      >
        <div className="w-10 h-1 bg-field rounded-full mx-auto mb-5" aria-hidden="true"></div>

        <h2
          id="name-gate-title"
          className="text-2xl font-extrabold text-ink tracking-tight mb-1"
        >
          {t.nameGateTitle}
        </h2>
        <p className="text-sm text-body mb-6">{t.nameGateSubtitle}</p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="name-gate-input"
            className="block text-xs font-bold uppercase tracking-wider text-faint mb-2"
          >
            {t.nameGateLabel}
          </label>
          <input
            id="name-gate-input"
            type="text"
            autoFocus
            autoComplete="name"
            value={value}
            maxLength={DISPLAY_NAME_MAX}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "name-gate-error" : undefined}
            placeholder={t.nameGatePlaceholder}
            className="w-full bg-paper border border-field rounded-lg px-4 py-3 text-[15px] text-ink placeholder:text-faint outline-none focus:border-gold transition-colors"
          />

          {error && (
            <p id="name-gate-error" role="alert" className="text-red text-sm mt-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-5 bg-ink text-card border-none rounded-lg py-3 text-sm font-bold cursor-pointer hover:bg-ink/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? t.nameGateSaving : t.nameGateSubmit}
          </button>
        </form>
      </div>
    </div>
  );
};
