import React, { useState, useRef, useEffect } from "react";
import { Locale, Translations, PostType } from "../types";
import { COUNTRIES } from "../constants";
import { supabaseBrowser } from "../supabaseClient";
import { isValidContact } from "../../lib/contact";
import { X, Briefcase, Package, Sparkles, Phone, Send, AlertCircle, ArrowRight } from "lucide-react";

// Phone fields keep digits and the punctuation used by the +998/+82 formats
// in the placeholder; letters and everything else are dropped as the user types.
const sanitizePhone = (value: string) => value.replace(/[^\d+\-\s()]/g, "");

type FieldName = "fromCity" | "toCity" | "date" | "weight" | "note" | "contact";
type FieldErrors = Partial<Record<FieldName, string | undefined>>;

// Top-to-bottom order of the fields in the form, used to scroll to the first
// problem rather than whichever one happened to be checked first.
const FIELD_ORDER: FieldName[] = ["fromCity", "toCity", "date", "weight", "note", "contact"];

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? (
    <p className="mt-1.5 flex items-center gap-1.5 text-[#C23B3B] text-[12px] font-semibold">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {message}
    </p>
  ) : null;

// Applied to inputs that failed validation, replacing their usual border.
const ERROR_INPUT_CLASS = "border-[#C23B3B] focus:border-[#C23B3B] ring-1 ring-[#C23B3B]/30";

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
  const [contactMethod, setContactMethod] = useState<"telegram" | "phone">("telegram");
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

  const itemTypes = [
    { id: "docs", label: "Hujjatlar" },
    { id: "clothes", label: "Kiyim-kechak" },
    { id: "meds", label: "Dori-darmon" },
    { id: "food", label: "Oziq-ovqat" },
    { id: "phone", label: "Telefon/Texnika" },
    { id: "gift", label: "Sovg'a" },
  ];

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
      // Build ISO Date string (YYYY-MM-DD), or "flexible" when the requester
      // has no fixed date and it's left to be negotiated with the traveler.
      const dateString = dateFlexible
        ? "flexible"
        : `${currentYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;

      // Build Weight representation. 0 kg is valid: for a traveler it means
      // luggage-only (no per-kg space), for a request it drops the weight suffix.
      // The luggage word is stored as a neutral "chamadon" token — BoardingPass
      // and App expand it to the right Uzbek form from the count at render time.
      let finalWeight: string;
      if (postType === "traveler") {
        const parts: string[] = [];
        if (weightKg > 0) parts.push(`${weightKg} kg`);
        if (weightLuggage > 0) parts.push(`${weightLuggage} chamadon`);
        finalWeight = parts.join(" + ") || "0 kg";
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

  const itemChipBase = { fontFamily: "'Space Mono', monospace", fontSize: 12, padding: '8px 15px', border: '1px solid #D8D3C4', borderRadius: 100, background: '#FCFBF6', cursor: 'pointer', color: '#1B2A4A', transition: 'all .15s ease' };
  const itemChipActive = { ...itemChipBase, background: '#1B2A4A', color: '#FCFBF6', border: '1px solid #1B2A4A' };

  const itemTypeChips = itemTypes.map(it => ({
    ...it,
    style: selectedItems.includes(it.id) ? itemChipActive : itemChipBase,
  }));

  const luggageWordLabel = weightLuggage === 1 ? "chamadon" : "ta chamadon";

  const weekdays = ["Ya","Du","Se","Ch","Pa","Ju","Sh"];
  const monthShortNames = ["Yan","Fev","Mar","Apr","May","Iyun","Iyul","Avg","Sen","Okt","Noy","Dek"];

  return (
    <div 
      className="fixed inset-0 bg-[#1b2a4a]/45 backdrop-blur-[3px] flex items-end justify-center z-[100] animate-[fadein_0.2s_ease]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-[#FCFBF6] w-full max-w-[560px] rounded-t-2xl px-6 pt-4 pb-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative"
      >
        {/* Notch pull-bar */}
        <div className="w-10 h-1 bg-[#D8D3C4] rounded-full mx-auto mb-5"></div>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute right-[18px] top-[18px] bg-[#F2EFE6] border-none w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-[#1B2A4A] hover:bg-[#E4E0D2] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Tab Toggle between Traveler and Request — the active tab borrows the
            stamp styling from the post cards (see BoardingPass), so the blue/red
            colour coding means the same thing while composing as when browsing. */}
        <div className="flex bg-[#F2EFE6] border border-[#E9E5D8] rounded-xl p-1 mb-6 gap-1">
          <button
            type="button"
            onClick={() => setPostType("traveler")}
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              postType === "traveler"
                ? "bg-[#2A4B8D] text-[#FCFBF6] border border-dashed border-white/40 shadow-[0_3px_8px_rgba(27,42,74,0.15)] -rotate-[1.5deg]"
                : "border border-transparent text-[#5A6272] hover:text-[#2A4B8D]"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            {t.tabTraveler}
          </button>
          <button
            type="button"
            onClick={() => setPostType("request")}
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              postType === "request"
                ? "bg-[#C23B3B] text-[#FCFBF6] border border-dashed border-white/40 shadow-[0_3px_8px_rgba(27,42,74,0.15)] rotate-[1.5deg]"
                : "border border-transparent text-[#5A6272] hover:text-[#C23B3B]"
            }`}
          >
            <Package className="w-4 h-4" />
            {t.tabRequest}
          </button>
        </div>

        {/* Header Title */}
        <h2 className="text-2xl font-extrabold text-[#1B2A4A] tracking-tight mb-6">{t.addPostTitle}</h2>

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
                <label className="block text-[11px] font-bold text-[#8A8F98] tracking-wider uppercase mb-1.5">
                  Qaysi davlatdan
                </label>
                <select
                  value={fromCountry}
                  onChange={(e) => pickCountry("from", e.target.value)}
                  className="w-full p-3 border border-[#D8D3C4] focus:border-[#2A4B8D] rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] outline-none font-semibold"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.names[locale]}
                    </option>
                  ))}
                </select>
              </div>

              <ArrowRight className="w-5 h-5 text-[#C79A3E] pb-0.5 mb-2 flex-shrink-0 self-center" />

              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-bold text-[#8A8F98] tracking-wider uppercase mb-1.5">
                  Qaysi davlatga
                </label>
                <select
                  value={toCountry}
                  onChange={(e) => pickCountry("to", e.target.value)}
                  className="w-full p-3 border border-[#D8D3C4] focus:border-[#2A4B8D] rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] outline-none font-semibold"
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
                <label className="block text-[11px] font-bold text-[#8A8F98] tracking-wider uppercase mb-1.5">
                  Qaysi shahardan
                </label>
                <input
                  type="text"
                  ref={(el) => { fieldRefs.current.fromCity = el; }}
                  value={fromCity}
                  onChange={(e) => { setFromCity(e.target.value); clearError("fromCity"); }}
                  placeholder="Qayerdan (masalan: Seoul)"
                  maxLength={100}
                  className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] outline-none ${
                    errors.fromCity ? ERROR_INPUT_CLASS : "border-[#D8D3C4] focus:border-[#2A4B8D]"
                  }`}
                />
              </div>

              <ArrowRight className="w-5 h-5 text-[#C79A3E] pb-0.5 mb-2 flex-shrink-0 self-center" />

              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-bold text-[#8A8F98] tracking-wider uppercase mb-1.5">
                  Qaysi shaharga
                </label>
                <input
                  type="text"
                  ref={(el) => { fieldRefs.current.toCity = el; }}
                  value={toCity}
                  onChange={(e) => { setToCity(e.target.value); clearError("toCity"); }}
                  placeholder="Qayerga (masalan: Toshkent)"
                  maxLength={100}
                  className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] outline-none ${
                    errors.toCity ? ERROR_INPUT_CLASS : "border-[#D8D3C4] focus:border-[#2A4B8D]"
                  }`}
                />
              </div>
            </div>
            <FieldError message={errors.fromCity || errors.toCity} />
          </div>

          {/* Date Selection Section */}
          <div ref={(el) => { fieldRefs.current.date = el; }}>
            <label className="block font-mono text-[10.5px] tracking-wider uppercase text-[#2A4B8D] font-bold mb-2">
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
                        ? "bg-[#1B2A4A] text-[#FCFBF6]"
                        : "bg-[#F2EFE6] text-[#6B7280] hover:bg-[#E4E0D2]"
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
                        ? "bg-[#C79A3E] text-[#FCFBF6]"
                        : "bg-[#F2EFE6] text-[#6B7280] hover:bg-[#E4E0D2]"
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
                          ? "bg-[#1B2A4A] text-[#FCFBF6] border-[#1B2A4A] scale-105 shadow-sm"
                          : errors.date
                            ? "bg-[#FCFBF6] text-[#1B2A4A] border-[#C23B3B]"
                            : "bg-[#FCFBF6] text-[#1B2A4A] border-[#E4E0D2] hover:border-[#1B2A4A]"
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
            <label className="block font-mono text-[10.5px] tracking-wider uppercase text-[#2A4B8D] font-bold mb-2">
              {postType === "traveler" ? t.weightLabelTraveler : t.weightLabelRequest}
            </label>

            {postType === "traveler" ? (
              // Traveler: Weight Stepper + Suitcase Option
              <div className="flex flex-wrap items-center gap-4" ref={(el) => { fieldRefs.current.weight = el; }}>
                <div className={`flex items-center gap-3.5 bg-[#F2EFE6] border rounded-xl p-2.5 ${errors.weight ? "border-[#C23B3B]" : "border-[#E9E5D8]"}`}>
                  <button
                    type="button"
                    onClick={() => { setWeightKg(w => Math.max(0, w - 1)); clearError("weight"); }}
                    className="w-8 h-8 rounded-full bg-[#1B2A4A] text-[#FCFBF6] flex items-center justify-center text-lg font-bold hover:opacity-90"
                  >
                    −
                  </button>
                  <div className="flex flex-col items-center min-w-[50px]">
                    <span className="text-xl font-extrabold text-[#1B2A4A]">{weightKg}</span>
                    <span className="font-mono text-[9px] text-[#8A8F98] tracking-widest font-bold">KG</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setWeightKg(w => Math.min(40, w + 1)); clearError("weight"); }}
                    className="w-8 h-8 rounded-full bg-[#1B2A4A] text-[#FCFBF6] flex items-center justify-center text-lg font-bold hover:opacity-90"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {weightLuggage > 0 ? (
                    <div className="flex items-center gap-2.5 bg-[#1B2A4A] text-[#FCFBF6] rounded-xl py-2.5 px-4 animate-[popup_0.25s_ease]">
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
                      className={`font-mono text-xs font-semibold px-4 py-3 bg-[#FCFBF6] text-[#6B7280] border border-dashed rounded-lg hover:border-[#1B2A4A] ${
                        errors.weight ? "border-[#C23B3B]" : "border-[#D8D3C4]"
                      }`}
                    >
                      + {t.addLuggageBtn}
                    </button>
                  )}
                  {weightLuggage > 0 && (
                    <button
                      type="button"
                      onClick={() => setWeightLuggage(l => Math.min(5, l + 1))}
                      className="w-8 h-8 rounded-full bg-[#F2EFE6] text-[#1B2A4A] font-bold border border-[#D8D3C4] hover:bg-[#E4E0D2] flex items-center justify-center"
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
                  maxLength={100}
                  className="w-full box-sizing-border-box padding-12px-14px border-1.5px-solid border-[#D8D3C4] rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A]"
                  style={{ padding: "10px 14px", border: "1.5px solid #D8D3C4", borderRadius: "8px" }}
                />

                <div className="flex items-center gap-3.5 bg-[#F2EFE6] border border-[#E9E5D8] rounded-xl p-2.5 w-fit">
                  <button 
                    type="button"
                    onClick={() => setWeightKg(w => Math.max(0, w - 1))}
                    className="w-8 h-8 rounded-full bg-[#1B2A4A] text-[#FCFBF6] flex items-center justify-center text-lg font-bold hover:opacity-90"
                  >
                    −
                  </button>
                  <div className="flex flex-col items-center min-w-[50px]">
                    <span className="text-xl font-extrabold text-[#1B2A4A]">{weightKg}</span>
                    <span className="font-mono text-[9px] text-[#8A8F98] tracking-widest font-bold">KG</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWeightKg(w => Math.min(30, w + 1))}
                    className="w-8 h-8 rounded-full bg-[#1B2A4A] text-[#FCFBF6] flex items-center justify-center text-lg font-bold hover:opacity-90"
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
            <label className="block font-mono text-[10.5px] tracking-wider uppercase text-[#2A4B8D] font-bold mb-1.5">
              {t.noteLabel.replace(" (ixtiyoriy)", "").replace(" (опционально)", "").replace(" (optional)", "")} <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={(el) => { fieldRefs.current.note = el; }}
              value={note}
              onChange={(e) => { setNote(e.target.value); clearError("note"); }}
              placeholder={t.notePlaceholder}
              maxLength={1000}
              className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] resize-y min-h-[72px] outline-none ${
                errors.note ? ERROR_INPUT_CLASS : "border-[#D8D3C4] focus:border-[#2A4B8D]"
              }`}
            ></textarea>
            <div className={`font-mono text-[10.5px] text-right mt-1 ${note.length >= 1000 ? "text-[#C23B3B]" : "text-[#8A8F98]"}`}>
              {note.length}/1000
            </div>
            <FieldError message={errors.note} />
          </div>

          {/* Contact */}
          <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-mono text-[10.5px] tracking-wider uppercase text-[#2A4B8D] font-bold">
                  {t.contactLabel} <span className="text-red-500">*</span>
                </label>
                
                {/* Micro Tabs for Contact Choice */}
                <div className="flex bg-[#F2EFE6] border border-[#E9E5D8] rounded-lg p-0.5 gap-0.5 scale-[0.9] origin-right">
                  <button
                    type="button"
                    onClick={() => {
                      setContactMethod("telegram");
                      // Convert or auto-prepend if appropriate
                      if (contact && !contact.startsWith("@") && !contact.includes("+") && contact.length < 15) {
                        setContact("@" + contact.trim());
                      } else if (!contact) {
                        setContact("@");
                      }
                    }}
                    className={`px-3 py-1 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                      contactMethod === "telegram"
                        ? "bg-[#2A4B8D] text-white shadow-sm"
                        : "text-[#5A6272] hover:text-[#1B2A4A]"
                    }`}
                  >
                    <Send className="w-2.5 h-2.5" />
                    Telegram
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContactMethod("phone");
                      if (contact.startsWith("@")) {
                        setContact(contact.replace("@", ""));
                      }
                    }}
                    className={`px-3 py-1 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                      contactMethod === "phone"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-[#5A6272] hover:text-[#1B2A4A]"
                    }`}
                  >
                    <Phone className="w-2.5 h-2.5" />
                    Telefon
                  </button>
                </div>
              </div>

              <div className="relative">
                {/* Prefix Icon/Text */}
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[#8A8F98]">
                  {contactMethod === "telegram" ? (
                    <span className="font-mono text-sm font-bold text-[#2A4B8D] mr-0.5">@</span>
                  ) : (
                    <Phone className="w-4 h-4 text-emerald-600" />
                  )}
                </div>

                <input
                  type="text"
                  ref={(el) => { fieldRefs.current.contact = el; }}
                  inputMode={contactMethod === "phone" ? "tel" : "text"}
                  value={contactMethod === "telegram" && contact.startsWith("@") ? contact.substring(1) : contact}
                  onChange={(e) => {
                    const typed = e.target.value;
                    if (contactMethod === "telegram") {
                      // Always store with `@` in state
                      setContact(typed.startsWith("@") ? typed : "@" + typed);
                    } else {
                      setContact(sanitizePhone(typed));
                    }
                    clearError("contact");
                  }}
                  placeholder={
                    contactMethod === "telegram"
                      ? "username"
                      : "+998 90-123-4567 yoki +82 10-1234-5678"
                  }
                  maxLength={contactMethod === "telegram" ? 99 : 100}
                  className={`w-full box-sizing-border-box p-3 pl-8.5 border rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] font-mono transition-all ${
                    errors.contact
                      ? ERROR_INPUT_CLASS
                      : contactMethod === "telegram"
                        ? "border-[#D8D3C4] focus:border-[#2A4B8D] focus:ring-1 focus:ring-[#2A4B8D]"
                        : "border-[#D8D3C4] focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  }`}
                  style={{ paddingLeft: "34px" }}
                />
              </div>

              <FieldError message={errors.contact} />

              {/* Dynamic Helper Link or Country Code Suggestions */}
              {contactMethod === "telegram" ? (
                contact.trim().replace("@", "") && (
                  <div className="mt-1.5 font-mono text-[10.5px] text-[#2A4B8D] flex items-center gap-1.5 bg-[#E8EEF8]/60 px-2.5 py-1.5 rounded-md border border-[#D5E2F4] w-fit">
                    <Send className="w-3 h-3" />
                    <span className="opacity-75">Telegram havola:</span>
                    <a
                      href={`https://t.me/${contact.trim().replace("@", "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-[#C79A3E] font-bold hover:text-[#1B2A4A] tracking-tight"
                    >
                      t.me/{contact.trim().replace("@", "")}
                    </a>
                  </div>
                )
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!contact.startsWith("+998")) {
                        setContact("+998 " + contact.replace(/^\+?\d*/, "").trim());
                      }
                    }}
                    className="font-mono text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded hover:bg-emerald-100 transition-all"
                  >
                    🇺🇿 +998
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!contact.startsWith("+82")) {
                        setContact("+82 " + contact.replace(/^\+?\d*/, "").trim());
                      }
                    }}
                    className="font-mono text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded hover:bg-emerald-100 transition-all"
                  >
                    🇰🇷 +82
                  </button>
                </div>
              )}
            </div>

          {/* Secondary Contact (opposite method of primary) */}
          <div>
            {showContact2 ? (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-mono text-[10.5px] tracking-wider uppercase text-[#2A4B8D] font-bold">
                    {t.secondaryContactLabel || "Qo'shimcha bog'lanish"}
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowContact2(false); setContact2(""); }}
                    className="text-[#8A8F98] hover:text-[#C23B3B]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[#8A8F98]">
                    {contactMethod === "telegram" ? (
                      <Phone className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className="font-mono text-sm font-bold text-[#2A4B8D] mr-0.5">@</span>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode={contactMethod === "telegram" ? "tel" : "text"}
                    value={contact2}
                    onChange={(e) => {
                      const typed = e.target.value;
                      // Secondary is always the opposite method of the primary
                      setContact2(contactMethod === "telegram" ? sanitizePhone(typed) : typed);
                    }}
                    placeholder={
                      contactMethod === "telegram"
                        ? "+998 90-123-4567 yoki +82 10-1234-5678"
                        : "username"
                    }
                    maxLength={contactMethod === "telegram" ? 100 : 99}
                    className="w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] font-mono border-[#D8D3C4] focus:border-[#2A4B8D] focus:ring-1 focus:ring-[#2A4B8D]"
                    style={{ paddingLeft: "34px" }}
                  />
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowContact2(true)}
                className="font-mono text-xs font-semibold px-4 py-3 bg-[#FCFBF6] text-[#6B7280] border border-dashed border-[#D8D3C4] rounded-lg hover:border-[#1B2A4A]"
              >
                {contactMethod === "telegram" ? (t.addPhoneBtn || "+ Add phone number") : (t.addTelegramBtn || "+ Add Telegram")}
              </button>
            )}
          </div>

          {/* Submit-level error (API rejection, network failure) — not tied to
              any single field, so it sits with the control that failed. */}
          {submitError && (
            <div
              ref={submitErrorRef}
              className="flex items-start gap-2 bg-[#FBEAEA] border border-[#C23B3B]/30 rounded-lg px-3.5 py-3 text-[#C23B3B] text-sm font-semibold"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {submitError}
            </div>
          )}

          {/* Submit Button — tracks the selected post type's stamp colour */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3.5 text-[#FCFBF6] border-none rounded-lg font-bold text-base cursor-pointer mt-4 transition-colors ${
              postType === "traveler"
                ? "bg-[#2A4B8D] hover:bg-[#355CA8]"
                : "bg-[#C23B3B] hover:bg-[#D04A4A]"
            }`}
          >
            {submitting ? t.submittingBtn : t.submitBtn}
          </button>

          <div className="text-center font-mono text-[10.5px] text-[#8A8F98]">
            {t.autoDeleteLabel}
          </div>
        </form>
      </div>
    </div>
  );
};
