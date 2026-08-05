import React, { useEffect, useRef, useState } from "react";
import { X, Megaphone, AlertCircle } from "lucide-react";
import { ContactMethod, Translations } from "../types";
import { supabaseBrowser } from "../supabaseClient";
import { isValidContact } from "../../lib/contact";
import { ContactFields } from "./ContactFields";
import { useDialog } from "../hooks/useDialog";

// Matches the server's cap on an announcement body (api/posts.ts). Long enough
// to describe a service properly; still short enough that a note stays a
// pointer to a conversation rather than the conversation.
export const NOTE_MAX = 500;

type FieldName = "text" | "contact";
type FieldErrors = Partial<Record<FieldName, string | undefined>>;

const FIELD_ORDER: FieldName[] = ["text", "contact"];

const ERROR_INPUT_CLASS =
  "border-red focus:border-red ring-1 ring-red/30";

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? (
    <p className="mt-1.5 flex items-center gap-1.5 text-red text-[12px] font-semibold">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {message}
    </p>
  ) : null;

interface NoteFormModalProps {
  t: Translations;
  // The corridor the viewer is browsing. A note sits in one country, and this
  // is the one it will surface under — asked implicitly rather than as a field,
  // because the composer has no structured inputs.
  country: string;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

// Matches the server's cap on an announcement headline (api/posts.ts).
const THEME_MAX = 80;

/**
 * The note sheet — "E'lon" / "Заметка" / "Note".
 *
 * The whole form is an optional theme, one text box and a contact. No date, no
 * cargo, no route:
 * the things people post here — a cargo service, an agency, a shop — are
 * standing offers, and every structured field the parcel form asks for would be
 * a question the author has no honest answer to.
 *
 * Posts as an `announcement` row, which is the same thing under its stored
 * name. The text travels as `note` and the theme as `headline`. The theme is
 * optional — left blank it stores null, and the card and the detail sheet
 * render the text on its own.
 *
 * Not to be confused with src/notes/, which holds the static editorial board
 * cards. Those never touch the API; these are user content.
 */
export const NoteFormModal: React.FC<NoteFormModalProps> = ({
  t,
  country,
  onClose,
  onSubmitSuccess,
}) => {
  const panelRef = useDialog<HTMLDivElement>(onClose);
  const [theme, setTheme] = useState("");
  const [text, setText] = useState("");

  const [contactMethod, setContactMethod] = useState<ContactMethod>("telegram");
  const [contact, setContact] = useState("");
  const [contact2, setContact2] = useState("");
  const [showContact2, setShowContact2] = useState(false);

  // Honeypot spam trap — hidden from humans, filled by naive bots.
  const [honeypot, setHoneypot] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fieldRefs = useRef<Partial<Record<FieldName, HTMLElement | null>>>({});
  const submitErrorRef = useRef<HTMLDivElement>(null);

  const clearError = (field: FieldName) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  useEffect(() => {
    if (submitError) submitErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [submitError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const next: FieldErrors = {};

    if (!text.trim()) {
      next.text = t.errorFieldNoteText || t.errorRequiredFields;
    }

    // The secondary handle is always the opposite channel of the primary.
    const contact2Method: ContactMethod = contactMethod === "telegram" ? "phone" : "telegram";
    // ContactFields keeps the primary Telegram handle with its "@" in state but
    // stores the secondary raw — the "@" shown next to it is a decorative icon.
    // Normalise here so what gets validated is what gets sent, and so the API's
    // isValidContact (which requires the leading "@") doesn't reject it.
    const normalizedContact2 = (() => {
      const trimmed = contact2.trim();
      if (!showContact2 || !trimmed) return null;
      if (contact2Method === "telegram") return trimmed.startsWith("@") ? trimmed : "@" + trimmed;
      return trimmed.startsWith("@") ? trimmed.substring(1) : trimmed;
    })();

    // Optional on a note — it is a notice, not a transaction. Given one, it
    // still has to be a real handle; an optional field is not an unchecked one.
    if (!contact.trim() && normalizedContact2) {
      // The second handle is an addition to the first, never a replacement.
      next.contact = t.errorFieldContact || t.errorRequiredFields;
    } else if (!contact.trim()) {
      // No contact at all is fine.
    } else if (!isValidContact(contact.trim(), contactMethod)) {
      next.contact =
        contactMethod === "telegram" ? t.errorContactTelegram : t.errorContactPhone;
    } else if (normalizedContact2 && !isValidContact(normalizedContact2, contact2Method)) {
      // Checked here rather than only server-side so the message lands on the
      // field instead of arriving as a generic submit failure.
      next.contact =
        contact2Method === "telegram" ? t.errorContactTelegram : t.errorContactPhone;
    }

    setErrors(next);

    const firstBad = FIELD_ORDER.find((f) => next[f]);
    if (firstBad) {
      fieldRefs.current[firstBad]?.scrollIntoView({ behavior: "smooth", block: "center" });
      (fieldRefs.current[firstBad] as HTMLElement | undefined)?.focus?.();
      return;
    }

    // Bots that fill the honeypot get the success path and no request, so the
    // trap isn't obvious from the outside.
    if (honeypot) {
      onSubmitSuccess();
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type: "announcement" as const,
        // The text travels as `note` — notes and parcel posts share that
        // column, since it is the same thing: the free text of an ad. No
        // headline is sent; the API stores null and the card reads the text.
        headline: theme.trim() || null,
        note: text.trim(),
        // Two facts, not one. from_country is where the service sits; the API
        // leaves to_country null. corridor_country is which board it is listed
        // on — the corridor the author was browsing when they hit "+". They are
        // the same code today because the composer asks neither question, but
        // the feed matches on the corridor, so a note never leaks onto a
        // corridor that opens later.
        from_country: country,
        corridor_country: country,
        // Both empty when the author left the field blank. The API stores
        // contact_type NULL then, which is what the detail sheet branches on.
        contact: contact.trim(),
        contact_type: contact.trim() ? contactMethod : null,
        contact2: normalizedContact2,
        contact2_type: normalizedContact2 ? contact2Method : null,
        honeypot, // re-checked server-side
      };

      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        onSubmitSuccess();
      } else {
        // 409 is the one-active-note cap. It is a normal outcome with its own
        // message from the API, so it flows through the same banner rather than
        // being flattened into a generic error.
        setSubmitError(result.error || t.errorGeneral);
      }
    } catch (err) {
      console.error("Error creating note:", err);
      setSubmitError(t.errorGeneral);
    } finally {
      setSubmitting(false);
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
        aria-labelledby="note-form-title"
        tabIndex={-1}
        className="bg-card w-full max-w-[560px] rounded-t-2xl px-6 pt-4 pb-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative outline-none"
      >
        {/* Notch pull-bar */}
        <div className="w-10 h-1 bg-field rounded-full mx-auto mb-5" aria-hidden="true" />

        <button
          onClick={onClose}
          aria-label={t.closeLabel || "Yopish"}
          className="absolute right-[18px] top-[18px] bg-paper border-none w-8 h-8 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-rule transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Header — gold, matching the note option on the speed dial, so the
            sheet is visibly not the parcel form. */}
        <div className="flex items-start gap-3 mb-6">
          <span className="w-10 h-10 flex-shrink-0 rounded-full bg-gold text-ink flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </span>
          <div>
            <h2 id="note-form-title" className="text-2xl font-extrabold text-ink tracking-tight m-0">
              {t.noteTitle}
            </h2>
            <p className="text-[13px] text-body m-0 mt-1 leading-snug">
              {t.noteSubtitle}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Honeypot Spam Trap (Hidden for humans) */}
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ display: "none" }}
            tabIndex={-1}
            autoComplete="off"
          />

          {/* Optional theme — shows bold and bigger on the card when given, same
              as the older headline field. Left blank, the body text alone
              carries the ad. */}
          <div>
            <label className="block text-[11px] font-bold text-faint tracking-wider uppercase mb-1.5">
              {t.noteThemeLabel || "Theme"}
            </label>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              maxLength={THEME_MAX}
              placeholder={t.noteThemePlaceholder}
              className="w-full box-sizing-border-box p-3 border rounded-lg text-base font-bold bg-card text-ink outline-none border-field focus:border-gold placeholder:font-normal placeholder:text-faint"
            />
          </div>

          {/* The whole ad. One box, no structure. */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-faint tracking-wider uppercase">
                {t.noteTextLabel}
              </label>
              <span className="font-mono text-[10px] text-faint">
                {text.length}/{NOTE_MAX}
              </span>
            </div>
            <textarea
              ref={(el) => { fieldRefs.current.text = el; }}
              value={text}
              onChange={(e) => { setText(e.target.value); clearError("text"); }}
              maxLength={NOTE_MAX}
              rows={6}
              placeholder={t.noteTextPlaceholder}
              className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-card text-ink outline-none resize-y leading-relaxed ${
                errors.text ? ERROR_INPUT_CLASS : "border-field focus:border-gold"
              }`}
            />
            <FieldError message={errors.text} />
          </div>

          {/* Optional, and kept off the feed card by design — a handle that is
              given shows in the detail sheet, behind the same login gate as
              every other ad. */}
          <ContactFields
            t={t}
            label={t.noteContactLabel || t.contactLabel}
            method={contactMethod}
            onMethodChange={setContactMethod}
            contact={contact}
            onContactChange={(v) => { setContact(v); clearError("contact"); }}
            contact2={contact2}
            onContact2Change={setContact2}
            showContact2={showContact2}
            onShowContact2Change={setShowContact2}
            error={errors.contact}
            inputRef={(el) => { fieldRefs.current.contact = el; }}
          />

          {/* Always-mounted live region, `sr-only` until it has something to
              say — see the matching block in PostFormModal for why the
              conditional wrapper this replaced never announced. */}
          <div
            ref={submitErrorRef}
            role="alert"
            className={
              submitError
                ? "flex items-start gap-2 bg-[#FBEAEA] border border-red/30 rounded-lg px-3.5 py-3 text-red text-sm font-semibold"
                : "sr-only"
            }
          >
            {submitError ? (
              <>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                {submitError}
              </>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-gold hover:bg-[#D6AA4E] text-ink border-none rounded-lg font-bold text-base cursor-pointer mt-4 transition-colors disabled:opacity-60"
          >
            {submitting ? t.submittingBtn : t.noteSubmitBtn}
          </button>

          <div className="text-center font-mono text-[10.5px] text-faint">
            {t.noteAutoDeleteLabel}
          </div>
        </form>
      </div>
    </div>
  );
};
