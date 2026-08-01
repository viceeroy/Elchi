import React, { useEffect, useRef, useState } from "react";
import { X, StickyNote, AlertCircle } from "lucide-react";
import { ContactMethod, Locale, Translations } from "../types";
import { COUNTRIES } from "../constants";
import { supabaseBrowser } from "../supabaseClient";
import { isValidContact } from "../../lib/contact";
import { ContactFields } from "./ContactFields";

// Caps mirror what the announcement columns will hold. Business ads attract
// wall-of-text spam, so the body is deliberately short — a note is a pointer to
// a conversation, not the conversation.
export const HEADLINE_MAX = 80;
export const BODY_MAX = 500;

type FieldName = "headline" | "body" | "contact";
type FieldErrors = Partial<Record<FieldName, string | undefined>>;

const FIELD_ORDER: FieldName[] = ["headline", "body", "contact"];

const ERROR_INPUT_CLASS =
  "border-[#C23B3B] focus:border-[#C23B3B] ring-1 ring-[#C23B3B]/30";

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? (
    <p className="mt-1.5 flex items-center gap-1.5 text-[#C23B3B] text-[12px] font-semibold">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {message}
    </p>
  ) : null;

interface AnnouncementFormModalProps {
  t: Translations;
  locale: Locale;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

/**
 * The announcement sheet — "E'lon" / "Заметка" / "Note".
 *
 * A plain ad: a headline, a body, the route it applies to, and a contact.
 * Deliberately none of the parcel fields (date, weight, luggage, categories),
 * because the things people post here — a cargo service, an agency, a shop —
 * are standing offers rather than one trip.
 *
 * The route is still required so the same country filter that drives the feed
 * applies here too: "cargo Korea → Uzbekistan" is as directional as a flight.
 *
 * Not to be confused with src/notes/, which holds the static editorial board
 * cards. Those never touch the API; these are user content.
 */
export const AnnouncementFormModal: React.FC<AnnouncementFormModalProps> = ({
  t,
  locale,
  onClose,
  onSubmitSuccess,
}) => {
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");

  // Route countries (ISO codes). Picking on one side the country already on
  // the other side swaps them, so from ≠ to always holds.
  const [fromCountry, setFromCountry] = useState("KR");
  const [toCountry, setToCountry] = useState("UZ");

  const pickCountry = (side: "from" | "to", code: string) => {
    if (side === "from") {
      if (code === toCountry) setToCountry(fromCountry);
      setFromCountry(code);
    } else {
      if (code === fromCountry) setFromCountry(toCountry);
      setToCountry(code);
    }
  };

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

    if (!headline.trim()) {
      next.headline = t.errorFieldHeadline || t.errorRequiredFields;
    }
    if (!body.trim()) {
      next.body = t.errorFieldBody || t.errorRequiredFields;
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

    if (!contact.trim()) {
      next.contact = t.errorFieldContact || t.errorRequiredFields;
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
        headline: headline.trim(),
        // The body travels as `note` — announcements and parcel posts share
        // that column, since it is the same thing: the free text of an ad.
        note: body.trim(),
        from_country: fromCountry,
        to_country: toCountry,
        contact: contact.trim(),
        contact_type: contactMethod,
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
        // 409 is the one-active-announcement cap. It is a normal outcome with
        // its own message from the API, so it flows through the same banner
        // rather than being flattened into a generic error.
        setSubmitError(result.error || t.errorGeneral);
      }
    } catch (err) {
      console.error("Error creating announcement:", err);
      setSubmitError(t.errorGeneral);
    } finally {
      setSubmitting(false);
    }
  };

  const countryLabel = (side: "from" | "to") =>
    side === "from"
      ? locale === "uz" ? "Qaysi davlatdan" : locale === "ru" ? "Из какой страны" : "From country"
      : locale === "uz" ? "Qaysi davlatga" : locale === "ru" ? "В какую страну" : "To country";

  return (
    <div
      className="fixed inset-0 bg-[#1b2a4a]/45 backdrop-blur-[3px] flex items-end justify-center z-[100] animate-[fadein_0.2s_ease]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#FCFBF6] w-full max-w-[560px] rounded-t-2xl px-6 pt-4 pb-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative">
        {/* Notch pull-bar */}
        <div className="w-10 h-1 bg-[#D8D3C4] rounded-full mx-auto mb-5" />

        <button
          onClick={onClose}
          className="absolute right-[18px] top-[18px] bg-[#F2EFE6] border-none w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-[#1B2A4A] hover:bg-[#E4E0D2] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header — gold, matching the note option on the speed dial, so the
            sheet is visibly not the parcel form. */}
        <div className="flex items-start gap-3 mb-6">
          <span className="w-10 h-10 flex-shrink-0 rounded-full bg-[#C79A3E] text-[#1B2A4A] flex items-center justify-center">
            <StickyNote className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-2xl font-extrabold text-[#1B2A4A] tracking-tight m-0">
              {t.announcementTitle}
            </h2>
            <p className="text-[13px] text-[#6B7280] m-0 mt-1 leading-snug">
              {t.announcementSubtitle}
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

          {/* Headline */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-[#8A8F98] tracking-wider uppercase">
                {t.announcementHeadlineLabel}
              </label>
              <span className="font-mono text-[10px] text-[#8A8F98]">
                {headline.length}/{HEADLINE_MAX}
              </span>
            </div>
            <input
              type="text"
              ref={(el) => { fieldRefs.current.headline = el; }}
              value={headline}
              onChange={(e) => { setHeadline(e.target.value); clearError("headline"); }}
              placeholder={t.announcementHeadlinePlaceholder}
              maxLength={HEADLINE_MAX}
              className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm font-semibold bg-[#FCFBF6] text-[#1B2A4A] outline-none ${
                errors.headline ? ERROR_INPUT_CLASS : "border-[#D8D3C4] focus:border-[#C79A3E]"
              }`}
            />
            <FieldError message={errors.headline} />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-[#8A8F98] tracking-wider uppercase">
                {t.announcementBodyLabel}
              </label>
              <span className="font-mono text-[10px] text-[#8A8F98]">
                {body.length}/{BODY_MAX}
              </span>
            </div>
            <textarea
              ref={(el) => { fieldRefs.current.body = el; }}
              value={body}
              onChange={(e) => { setBody(e.target.value); clearError("body"); }}
              placeholder={t.announcementBodyPlaceholder}
              maxLength={BODY_MAX}
              rows={5}
              className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] outline-none resize-y leading-relaxed ${
                errors.body ? ERROR_INPUT_CLASS : "border-[#D8D3C4] focus:border-[#C79A3E]"
              }`}
            />
            <FieldError message={errors.body} />
          </div>

          {/* Route — countries only. A note has no cities and no date, but it
              still belongs to a corridor, so the feed filter can reach it. */}
          <div>
            <label className="block text-[11px] font-bold text-[#8A8F98] tracking-wider uppercase mb-1.5">
              {t.announcementRouteLabel}
            </label>
            <div className="flex flex-row items-end gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <span className="block font-mono text-[10px] text-[#8A8F98] mb-1">
                  {countryLabel("from")}
                </span>
                <select
                  value={fromCountry}
                  onChange={(e) => pickCountry("from", e.target.value)}
                  className="w-full p-3 border border-[#D8D3C4] focus:border-[#C79A3E] rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] outline-none font-semibold"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.names[locale]}
                    </option>
                  ))}
                </select>
              </div>

              <span className="flex items-center justify-center text-[#C79A3E] font-bold text-lg pb-2.5 flex-shrink-0">➔</span>

              <div className="flex-1 min-w-0">
                <span className="block font-mono text-[10px] text-[#8A8F98] mb-1">
                  {countryLabel("to")}
                </span>
                <select
                  value={toCountry}
                  onChange={(e) => pickCountry("to", e.target.value)}
                  className="w-full p-3 border border-[#D8D3C4] focus:border-[#C79A3E] rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] outline-none font-semibold"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.names[locale]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <ContactFields
            t={t}
            locale={locale}
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

          {submitError && (
            <div
              ref={submitErrorRef}
              className="flex items-start gap-2 bg-[#FBEAEA] border border-[#C23B3B]/30 rounded-lg px-3.5 py-3 text-[#C23B3B] text-sm font-semibold"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-[#C79A3E] hover:bg-[#D6AA4E] text-[#1B2A4A] border-none rounded-lg font-bold text-base cursor-pointer mt-4 transition-colors disabled:opacity-60"
          >
            {submitting ? t.submittingBtn : t.announcementSubmitBtn}
          </button>

          <div className="text-center font-mono text-[10.5px] text-[#8A8F98]">
            {t.announcementAutoDeleteLabel}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AnnouncementFormModal;
