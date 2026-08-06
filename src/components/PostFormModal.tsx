import React, { useState, useRef, useEffect } from "react";
import { Locale, Translations, PostType, ContactMethod } from "../types";
import { COUNTRIES } from "../constants";
import { supabaseBrowser } from "../supabaseClient";
import { isValidContact } from "../../lib/contact";
import {
  PARCEL_CITY_MAX,
  PARCEL_CATEGORY_OTHER_MAX,
  PARCEL_NOTE_MAX,
} from "../../lib/parcelLimits";
import { PARCEL_CATEGORY_IDS } from "../../lib/parcelCategories";
import { buildWeightString } from "../../lib/weight";
import { pluralizeChamadon } from "../translations";
import { FLEXIBLE_DATE } from "../../lib/date";
import { X, Plane, Briefcase, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import { ContactFields } from "./ContactFields";
import { useDialog } from "../hooks/useDialog";

type FieldName = "fromCity" | "toCity" | "date" | "weight" | "note" | "contact";
type FieldErrors = Partial<Record<FieldName, string | undefined>>;

// Top-to-bottom order of the fields in the form, used to scroll to the first
// problem rather than whichever one happened to be checked first.
const FIELD_ORDER: FieldName[] = ["fromCity", "toCity", "date", "weight", "note", "contact"];

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? (
    <p className="mt-1.5 flex items-center gap-1.5 text-red text-[12px] font-semibold">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {message}
    </p>
  ) : null;

// Applied to inputs that failed validation, replacing their usual border.
const ERROR_INPUT_CLASS = "border-red focus:border-red ring-1 ring-red/30";

interface PostFormModalProps {
  t: Translations;
  locale: Locale;
  // Which side of the ad the composer opened on — the speed dial asks before
  // the sheet opens, so the form starts on the tab the user already picked.
  // The tab toggle stays: switching sides shouldn't cost a close-and-reopen.
  initialType?: PostType;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export const PostFormModal: React.FC<PostFormModalProps> = ({
  t,
  locale,
  initialType = "traveler",
  onClose,
  onSubmitSuccess,
}) => {
  const [postType, setPostType] = useState<PostType>(initialType);
  const panelRef = useDialog<HTMLDivElement>(onClose);
  // Route countries (ISO codes). Picking on one side the country already on
  // the other side swaps them, so from ≠ to always holds.
  const [fromCountry, setFromCountry] = useState<string>("KR");
  const [toCountry, setToCountry] = useState<string>("UZ");

  const pickCountry = (side: "from" | "to", code: string) => {
    if (side === "from") {
      if (code === toCountry) setToCountry(fromCountry);
      setFromCountry(code);
    } else {
      if (code === fromCountry) setFromCountry(toCountry);
      setToCountry(code);
    }
  };
  const [fromCity, setFromCity] = useState<string>("");
  const [toCity, setToCity] = useState<string>("");
  const [note, setNote] = useState("");
  const [contact, setContact] = useState("");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("telegram");
  const [showContact2, setShowContact2] = useState(false);
  const [contact2, setContact2] = useState("");
  
  // Date Selection State (Month + Day) — no day preselected; user must pick one
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // "Kelishiladi" — requester has no fixed date, date is negotiable
  const [dateFlexible, setDateFlexible] = useState(false);

  // Weight & Luggage State — starts at 0 (no preselected weight); 0 kg is allowed
  const [weightKg, setWeightKg] = useState<number>(0);
  const [weightLuggage, setWeightLuggage] = useState<number>(0);
  
  // Request Parcel Categories — multi-select (user can pick several or all)
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [customItemType, setCustomItemType] = useState("");

  const toggleItem = (id: string) =>
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Honeypot spam trap
  const [honeypot, setHoneypot] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const fieldRefs = useRef<Partial<Record<FieldName, HTMLElement | null>>>({});
  // Failures that belong to the submit itself (rejected by the API, network
  // down) rather than to any one field, shown above the submit button.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitErrorRef = useRef<HTMLDivElement>(null);

  // Clear a field's error as soon as the user acts on it, so the message goes
  // away while they type instead of lingering until the next submit.
  const clearError = (field: FieldName) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  // Bring a submit-level failure into view — it renders below the fold, next
  // to the button the user just pressed.
  useEffect(() => {
    if (submitError) submitErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [submitError]);

  // Labels are local — only the ids are shared with the server's allow-list.
  const CATEGORY_LABELS: Record<(typeof PARCEL_CATEGORY_IDS)[number], string> = {
    docs: "Hujjatlar",
    clothes: "Kiyim-kechak",
    meds: "Dori-darmon",
    food: "Oziq-ovqat",
    phone: "Telefon/Texnika",
    gift: "Sovg'a",
  };
  const itemTypes = PARCEL_CATEGORY_IDS.map((id) => ({ id, label: CATEGORY_LABELS[id] }));

  // Helper: Get list of days in selected month
  const getDaysInMonth = (month: number) => {
    const currentYear = today.getFullYear();
    const date = new Date(currentYear, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const currentYear = today.getFullYear();
  const nextMonth = (today.getMonth() + 1) % 12;
  const monthOptions = [
    { value: today.getMonth(), label: "Ushbu oy" },
    { value: nextMonth, label: "Keyingi oy" },
  ];

  const daysList = getDaysInMonth(selectedMonth).filter(d => {
    // If it's the current month, only show today and future days
    if (selectedMonth === today.getMonth()) {
      return d.getDate() >= today.getDate();
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Spam Trap: Check Honeypot
    if (honeypot.trim() !== "") {
      console.warn("Spam detected: Bot submitted honeypot field.");
      return;
    }

    // A previous failure no longer describes this attempt.
    setSubmitError(null);

    // 2. Client-side Validation. Every problem is reported inline on the field
    // itself rather than in a dialog, so collect them all in one pass and then
    // bring the first one into view.
    const nextErrors: FieldErrors = {};

    if (!fromCity.trim()) nextErrors.fromCity = t.errorFieldFromCity;
    if (!toCity.trim()) nextErrors.toCity = t.errorFieldToCity;
    if (selectedDay === null && !dateFlexible) nextErrors.date = t.errorFieldDate;
    if (postType === "traveler" && weightKg === 0 && weightLuggage === 0) {
      nextErrors.weight = t.errorFieldWeight;
    }
    if (!note.trim()) nextErrors.note = t.errorFieldNote;
    if (!contact.trim()) {
      nextErrors.contact = t.errorFieldContact;
    } else {
      // Mirror the API's rule so a malformed handle is caught inline rather
      // than coming back as an opaque server error. The API re-checks this —
      // it is the security boundary; this is only the faster feedback path.
      const normalized = contactMethod === "telegram"
        ? (contact.trim().startsWith("@") ? contact.trim() : `@${contact.trim()}`)
        : contact.trim().replace(/^@/, "");
      if (!isValidContact(normalized, contactMethod)) {
        nextErrors.contact = contactMethod === "telegram"
          ? t.errorContactTelegram
          : t.errorContactPhone;
      }
    }

    setErrors(nextErrors);

    const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstInvalid) {
      const el = fieldRefs.current[firstInvalid];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      // Focus text inputs so the user can start typing straight away; the
      // custom widgets (date, weight, categories) are not focusable.
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus({ preventScroll: true });
      }
      return;
    }

    setSubmitting(true);

    try {
      // Build ISO Date string (YYYY-MM-DD), or FLEXIBLE_DATE when the
      // requester has no fixed date and it's left to be negotiated with the
      // traveler.
      const dateString = dateFlexible
        ? FLEXIBLE_DATE
        : `${currentYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;

      // Build Weight representation. 0 kg is valid: for a traveler it means
      // luggage-only (no per-kg space), for a request it drops the weight suffix.
      // The luggage word is stored as a neutral "chamadon" token — BoardingPass
      // and App expand it to the right Uzbek form from the count at render time.
      let finalWeight: string;
      if (postType === "traveler") {
        finalWeight = buildWeightString(weightKg, weightLuggage);
      } else {
        // Categories: comma-joined chip labels plus the free-text detail if given.
        // Weight string = "<kg> · <categories>"; the card shows only the kg part
        // (0 kg hidden), the detail modal shows the full string incl. categories.
        const labels = selectedItems
          .map(id => itemTypes.find(it => it.id === id)?.label)
          .filter((l): l is string => Boolean(l));
        if (customItemType.trim()) labels.push(customItemType.trim());
        const catStr = labels.join(", ");
        const kgStr = weightKg > 0 ? `${weightKg} kg` : "";
        finalWeight = [kgStr, catStr].filter(Boolean).join(" · ") || catStr || "Pochta";
      }

      let finalContact = contact.trim();
      if (contactMethod === "telegram") {
        if (!finalContact.startsWith("@")) {
          finalContact = "@" + finalContact;
        }
      } else {
        if (finalContact.startsWith("@")) {
          finalContact = finalContact.substring(1);
        }
      }

      // Secondary contact always uses the opposite method (phone if primary is Telegram, or vice versa)
      const contact2Method = contactMethod === "telegram" ? "phone" : "telegram";
      let finalContact2: string | null = null;
      if (showContact2 && contact2.trim()) {
        finalContact2 = contact2.trim();
        if (contact2Method === "telegram" && !finalContact2.startsWith("@")) {
          finalContact2 = "@" + finalContact2;
        } else if (contact2Method === "phone" && finalContact2.startsWith("@")) {
          finalContact2 = finalContact2.substring(1);
        }
      }

      const postData = {
        type: postType,
        // Structured route countries — the API derives the legacy direction
        // column for the KR↔UZ pair itself.
        from_country: fromCountry,
        to_country: toCountry,
        from_city: fromCity.trim(),
        to_city: toCity.trim(),
        date: dateString,
        // Structured cargo data. Travelers offer kg and/or luggage slots and
        // carry no categories; requesters pick categories and an optional kg.
        weight_kg: weightKg,
        luggage_count: postType === "traveler" ? weightLuggage : 0,
        categories: postType === "request" ? selectedItems : [],
        category_other: postType === "request" ? customItemType.trim() || null : null,
        // Display string kept alongside the fields it was built from.
        weight: finalWeight,
        note: note.trim(),
        contact: finalContact,
        contact_type: contactMethod,
        contact2: finalContact2,
        contact2_type: finalContact2 ? contact2Method : null,
        honeypot: honeypot // Passed so backend can verify as well
      };

      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(postData),
      });

      const result = await res.json();

      if (res.ok) {
        onSubmitSuccess();
      } else {
        setSubmitError(result.error || t.errorGeneral);
      }
    } catch (err) {
      console.error(err);
      setSubmitError(t.errorGeneral);
    } finally {
      setSubmitting(false);
    }
  };

  const itemChipBase = { fontFamily: "'Space Mono', monospace", fontSize: 12, padding: '8px 15px', border: '1px solid var(--color-field)', borderRadius: 100, background: 'var(--color-card)', cursor: 'pointer', color: 'var(--color-ink)', transition: 'all .15s ease' };
  const itemChipActive = { ...itemChipBase, background: 'var(--color-ink)', color: 'var(--color-card)', border: '1px solid var(--color-ink)' };

  const itemTypeChips = itemTypes.map(it => ({
    ...it,
    style: selectedItems.includes(it.id) ? itemChipActive : itemChipBase,
  }));

  const luggageWordLabel = pluralizeChamadon(weightLuggage);

  const weekdays = ["Ya","Du","Se","Ch","Pa","Ju","Sh"];
  const monthShortNames = ["Yan","Fev","Mar","Apr","May","Iyun","Iyul","Avg","Sen","Okt","Noy","Dek"];

  return (
    <div 
      className="fixed inset-0 bg-ink/45 backdrop-blur-[3px] flex items-end justify-center z-[100] animate-[fadein_0.2s_ease]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-form-title"
        tabIndex={-1}
        className="bg-card w-full max-w-[560px] rounded-t-2xl px-6 pt-4 pb-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative outline-none"
      >
        {/* Notch pull-bar */}
        <div className="w-10 h-1 bg-field rounded-full mx-auto mb-5" aria-hidden="true"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label={t.closeLabel || "Yopish"}
          className="absolute right-[18px] top-[18px] bg-paper border-none w-8 h-8 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-rule transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Tab Toggle between Traveler and Request — the active tab borrows the
            stamp styling from the post cards (see BoardingPass), so the blue/red
            colour coding means the same thing while composing as when browsing. */}
        <div className="flex bg-paper border border-edge rounded-xl p-1 mb-6 gap-1">
          <button
            type="button"
            onClick={() => setPostType("traveler")}
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              postType === "traveler"
                ? "bg-blue text-card border border-dashed border-white/40 shadow-[0_3px_8px_rgba(27,42,74,0.15)] -rotate-[1.5deg]"
                : "border border-transparent text-body hover:text-blue"
            }`}
          >
            <Plane className="w-4 h-4" />
            {t.tabTraveler}
          </button>
          <button
            type="button"
            onClick={() => setPostType("request")}
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              postType === "request"
                ? "bg-red text-card border border-dashed border-white/40 shadow-[0_3px_8px_rgba(27,42,74,0.15)] rotate-[1.5deg]"
                : "border border-transparent text-body hover:text-red"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            {t.tabRequest}
          </button>
        </div>

        {/* Header Title */}
        <h2 id="post-form-title" className="text-2xl font-extrabold text-ink tracking-tight mb-6">{t.addPostTitle}</h2>

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

          {/* Route Section with Direction Toggle and Dropdowns */}
          <div>
            {/* Country pickers — any pair of two different countries. Picking
                the country already on the other side swaps them. */}
            <div className="flex flex-row items-end gap-2 sm:gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-bold text-faint tracking-wider uppercase mb-1.5">
                  Qaysi davlatdan
                </label>
                <select
                  value={fromCountry}
                  onChange={(e) => pickCountry("from", e.target.value)}
                  className="w-full p-3 border border-field focus:border-blue rounded-lg text-sm bg-card text-ink outline-none font-semibold"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.names[locale]}
                    </option>
                  ))}
                </select>
              </div>

              <ArrowRight className="w-5 h-5 text-gold pb-0.5 mb-2 flex-shrink-0 self-center" />

              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-bold text-faint tracking-wider uppercase mb-1.5">
                  Qaysi davlatga
                </label>
                <select
                  value={toCountry}
                  onChange={(e) => pickCountry("to", e.target.value)}
                  className="w-full p-3 border border-field focus:border-blue rounded-lg text-sm bg-card text-ink outline-none font-semibold"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.names[locale]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Free-text From / To cities (display only — filtering uses countries) */}
            <div className="flex flex-row items-end gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-bold text-faint tracking-wider uppercase mb-1.5">
                  Qaysi shahardan
                </label>
                <input
                  type="text"
                  ref={(el) => { fieldRefs.current.fromCity = el; }}
                  value={fromCity}
                  onChange={(e) => { setFromCity(e.target.value); clearError("fromCity"); }}
                  placeholder="Qayerdan (masalan: Seoul)"
                  maxLength={PARCEL_CITY_MAX}
                  className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-card text-ink outline-none ${
                    errors.fromCity ? ERROR_INPUT_CLASS : "border-field focus:border-blue"
                  }`}
                />
              </div>

              <ArrowRight className="w-5 h-5 text-gold pb-0.5 mb-2 flex-shrink-0 self-center" />

              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-bold text-faint tracking-wider uppercase mb-1.5">
                  Qaysi shaharga
                </label>
                <input
                  type="text"
                  ref={(el) => { fieldRefs.current.toCity = el; }}
                  value={toCity}
                  onChange={(e) => { setToCity(e.target.value); clearError("toCity"); }}
                  placeholder="Qayerga (masalan: Toshkent)"
                  maxLength={PARCEL_CITY_MAX}
                  className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-card text-ink outline-none ${
                    errors.toCity ? ERROR_INPUT_CLASS : "border-field focus:border-blue"
                  }`}
                />
              </div>
            </div>
            <FieldError message={errors.fromCity || errors.toCity} />
          </div>

          {/* Date Selection Section */}
          <div ref={(el) => { fieldRefs.current.date = el; }}>
            <label className="block font-mono text-[10.5px] tracking-wider uppercase text-blue font-bold mb-2">
              {postType === "traveler" ? t.dateLabelTraveler : t.dateLabelRequest}
            </label>
            <div className="flex flex-col gap-3">
              {/* Month Tabs + Flexible/Negotiable toggle (request posts only —
                  a requester may not have a fixed deadline, so the date can be
                  left to be worked out with the traveler). */}
              <div className="flex gap-2">
                {monthOptions.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => { setSelectedMonth(m.value); setSelectedDay(null); setDateFlexible(false); }}
                    className={`font-mono text-xs px-3.5 py-1.5 border-none rounded-full font-bold cursor-pointer transition-colors ${
                      selectedMonth === m.value && !dateFlexible
                        ? "bg-ink text-card"
                        : "bg-paper text-body hover:bg-rule"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
                {postType === "request" && (
                  <button
                    type="button"
                    onClick={() => { setDateFlexible(true); setSelectedDay(null); clearError("date"); }}
                    className={`font-mono text-xs px-3.5 py-1.5 border-none rounded-full font-bold cursor-pointer transition-colors ${
                      dateFlexible
                        ? "bg-gold text-card"
                        : "bg-paper text-body hover:bg-rule"
                    }`}
                  >
                    {t.dateFlexibleBtn}
                  </button>
                )}
              </div>

              {/* Horizontal Days Selector */}
              {!dateFlexible && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {daysList.map(d => {
                  const isSelected = d.getDate() === selectedDay;
                  return (
                    <button
                      key={d.getDate()}
                      type="button"
                      onClick={() => { setSelectedDay(d.getDate()); clearError("date"); }}
                      className={`font-mono flex flex-col items-center gap-0.5 min-w-[42px] p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-ink text-card border-ink scale-105 shadow-sm"
                          : errors.date
                            ? "bg-card text-ink border-red"
                            : "bg-card text-ink border-rule hover:border-ink"
                      }`}
                    >
                      <span className="text-[9px] opacity-65">{weekdays[d.getDay()]}</span>
                      <span className="text-15px font-bold">{d.getDate()}</span>
                      <span className="text-[8px] opacity-65">{monthShortNames[d.getMonth()]}</span>
                    </button>
                  );
                })}
              </div>
              )}
            </div>
            <FieldError message={errors.date} />
          </div>

          {/* Weight & Category Section */}
          <div>
            <label className="block font-mono text-[10.5px] tracking-wider uppercase text-blue font-bold mb-2">
              {postType === "traveler" ? t.weightLabelTraveler : t.weightLabelRequest}
            </label>

            {postType === "traveler" ? (
              // Traveler: Weight Stepper + Suitcase Option
              <div className="flex flex-wrap items-center gap-4" ref={(el) => { fieldRefs.current.weight = el; }}>
                <div className={`flex items-center gap-3.5 bg-paper border rounded-xl p-2.5 ${errors.weight ? "border-red" : "border-edge"}`}>
                  <button
                    type="button"
                    onClick={() => { setWeightKg(w => Math.max(0, w - 1)); clearError("weight"); }}
                    className="w-8 h-8 rounded-full bg-ink text-card flex items-center justify-center text-lg font-bold hover:opacity-90"
                  >
                    −
                  </button>
                  <div className="flex flex-col items-center min-w-[50px]">
                    <span className="text-xl font-extrabold text-ink">{weightKg}</span>
                    <span className="font-mono text-[9px] text-faint tracking-widest font-bold">KG</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setWeightKg(w => Math.min(40, w + 1)); clearError("weight"); }}
                    className="w-8 h-8 rounded-full bg-ink text-card flex items-center justify-center text-lg font-bold hover:opacity-90"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {weightLuggage > 0 ? (
                    <div className="flex items-center gap-2.5 bg-ink text-card rounded-xl py-2.5 px-4 animate-[popup_0.25s_ease]">
                      <span className="text-sm font-bold flex items-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        {weightLuggage} {luggageWordLabel}
                      </span>
                      <button 
                        type="button"
                        onClick={() => setWeightLuggage(0)}
                        className="text-gray-300 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setWeightLuggage(1); clearError("weight"); }}
                      className={`font-mono text-xs font-semibold px-4 py-3 bg-card text-body border border-dashed rounded-lg hover:border-ink ${
                        errors.weight ? "border-red" : "border-field"
                      }`}
                    >
                      + {t.addLuggageBtn}
                    </button>
                  )}
                  {weightLuggage > 0 && (
                    <button
                      type="button"
                      onClick={() => setWeightLuggage(l => Math.min(5, l + 1))}
                      className="w-8 h-8 rounded-full bg-paper text-ink font-bold border border-field hover:bg-rule flex items-center justify-center"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // Request: Category Selection + Weight Stepper
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {itemTypeChips.map(it => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => toggleItem(it.id)}
                      className="font-sans text-xs px-3.5 py-2.5 rounded-full border font-semibold flex items-center transition-all"
                      style={it.style as React.CSSProperties}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={customItemType}
                  onChange={(e) => setCustomItemType(e.target.value)}
                  placeholder={t.itemTypeOtherPlaceholder}
                  maxLength={PARCEL_CATEGORY_OTHER_MAX}
                  className="w-full box-sizing-border-box padding-12px-14px border-1.5px-solid border-field rounded-lg text-sm bg-card text-ink"
                  style={{ padding: "10px 14px", border: "1.5px solid var(--color-field)", borderRadius: "8px" }}
                />

                <div className="flex items-center gap-3.5 bg-paper border border-edge rounded-xl p-2.5 w-fit">
                  <button 
                    type="button"
                    onClick={() => setWeightKg(w => Math.max(0, w - 1))}
                    className="w-8 h-8 rounded-full bg-ink text-card flex items-center justify-center text-lg font-bold hover:opacity-90"
                  >
                    −
                  </button>
                  <div className="flex flex-col items-center min-w-[50px]">
                    <span className="text-xl font-extrabold text-ink">{weightKg}</span>
                    <span className="font-mono text-[9px] text-faint tracking-widest font-bold">KG</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWeightKg(w => Math.min(30, w + 1))}
                    className="w-8 h-8 rounded-full bg-ink text-card flex items-center justify-center text-lg font-bold hover:opacity-90"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
            {postType === "traveler" && <FieldError message={errors.weight} />}
          </div>

          {/* Note/Izoh — required */}
          <div>
            <label className="block font-mono text-[10.5px] tracking-wider uppercase text-blue font-bold mb-1.5">
              {t.noteLabel.replace(" (ixtiyoriy)", "").replace(" (опционально)", "").replace(" (optional)", "")} <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={(el) => { fieldRefs.current.note = el; }}
              value={note}
              onChange={(e) => { setNote(e.target.value); clearError("note"); }}
              placeholder={t.notePlaceholder}
              maxLength={PARCEL_NOTE_MAX}
              className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-card text-ink resize-y min-h-[72px] outline-none ${
                errors.note ? ERROR_INPUT_CLASS : "border-field focus:border-blue"
              }`}
            ></textarea>
            <div className={`font-mono text-[10.5px] text-right mt-1 ${note.length >= 1000 ? "text-red" : "text-faint"}`}>
              {note.length}/1000
            </div>
            <FieldError message={errors.note} />
          </div>

          {/* Contact — the shared block, same markup the note sheet renders.
              This was an inline copy of ContactFields.tsx: same toggle, same
              "@" prefix, same t.me preview, same +998/+82 shortcuts, and its
              own duplicate sanitizePhone. The two had already drifted (the
              toggle here was scaled to 90%), which is the whole argument for
              the component. */}
          <ContactFields
            t={t}
            label={<>{t.contactLabel} <span className="text-red-500">*</span></>}
            method={contactMethod}
            onMethodChange={(next) => {
              setContactMethod(next);
              // Carrying a half-typed value across the toggle, in the one
              // direction ContactFields leaves to its caller. A bare "someone"
              // becomes "@someone"; a value holding a "+" or running long is a
              // phone number typed under the other tab and is left alone. An
              // empty field is seeded with the "@" so the author types straight
              // into a username — safe here because a parcel post requires a
              // contact anyway, and unsafe on the note sheet, where it would
              // turn a deliberately blank optional field into an error.
              if (next !== "telegram") return;
              if (!contact) {
                setContact("@");
              } else if (
                !contact.startsWith("@") &&
                !contact.includes("+") &&
                contact.length < 15
              ) {
                setContact("@" + contact.trim());
              }
            }}
            contact={contact}
            onContactChange={(value) => { setContact(value); clearError("contact"); }}
            contact2={contact2}
            onContact2Change={setContact2}
            showContact2={showContact2}
            onShowContact2Change={(show) => {
              setShowContact2(show);
              if (!show) setContact2("");
            }}
            error={errors.contact}
            inputRef={(el) => { fieldRefs.current.contact = el; }}
          />

          {/* Submit-level error (API rejection, network failure) — not tied to
              any single field, so it sits with the control that failed.

              The container is always rendered and carries role="alert" for the
              life of the form; only its contents are conditional. Wrapping the
              whole thing in `{submitError && …}` is the obvious shape and the
              one that does not announce: a live region has to exist *before*
              the text lands in it, and that version created the region and the
              message in the same paint. While empty it is `sr-only`, which is
              absolutely positioned and therefore not a flex item — so it adds
              no gap to the form's `gap-5` column. */}
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

          {/* Submit Button — tracks the selected post type's stamp colour */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3.5 text-card border-none rounded-lg font-bold text-base cursor-pointer mt-4 transition-colors ${
              postType === "traveler"
                ? "bg-blue hover:bg-[#355CA8]"
                : "bg-red hover:bg-[#D04A4A]"
            }`}
          >
            {submitting ? t.submittingBtn : t.submitBtn}
          </button>

          <div className="text-center font-mono text-[10.5px] text-faint">
            {t.autoDeleteLabel}
          </div>
        </form>
      </div>
    </div>
  );
};
