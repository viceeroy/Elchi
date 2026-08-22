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
import { X, Plane, Briefcase, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import { ContactFields } from "./ContactFields";
import { useDialog } from "../hooks/useDialog";

type FieldName = "fromCity" | "toCity" | "date" | "weight" | "note" | "contact";
type FieldErrors = Partial<Record<FieldName, string | undefined>>;

const FIELD_ORDER: FieldName[] = ["fromCity", "toCity", "date", "weight", "note", "contact"];

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? (
    <p className="mt-1.5 flex items-center gap-1.5 text-red text-[12px] font-semibold">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {message}
    </p>
  ) : null;

const ERROR_INPUT_CLASS = "border-red focus:border-red ring-1 ring-red/30";

interface PostFormModalProps {
  t: Translations;
  locale: Locale;
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
  const [step, setStep] = useState(1);
  const [postType, setPostType] = useState<PostType>(initialType);
  const panelRef = useDialog<HTMLDivElement>(onClose);
  
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
  
  const today = new Date();
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const [weightKg, setWeightKg] = useState<number>(0);
  const [weightLuggage, setWeightLuggage] = useState<number>(0);
  
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [customItemType, setCustomItemType] = useState("");

  const toggleItem = (id: string) =>
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const fieldRefs = useRef<Partial<Record<FieldName, HTMLElement | null>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitErrorRef = useRef<HTMLDivElement>(null);

  const clearError = (field: FieldName) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  useEffect(() => {
    if (submitError) submitErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [submitError]);

  const CATEGORY_LABELS: Record<(typeof PARCEL_CATEGORY_IDS)[number], string> = {
    docs: "Hujjatlar",
    clothes: "Kiyim-kechak",
    meds: "Dori-darmon",
    food: "Oziq-ovqat",
    phone: "Telefon/Texnika",
    gift: "Sovg'a",
  };
  const itemTypes = PARCEL_CATEGORY_IDS.map((id) => ({ id, label: CATEGORY_LABELS[id] }));

  const daysList = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const formatDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const validateStep = (currentStep: number): boolean => {
    const nextErrors: FieldErrors = {};
    
    if (currentStep === 1) {
      // Nothing to validate here
    } else if (currentStep === 2) {
      // Countries always have a valid default
    } else if (currentStep === 3) {
      if (!fromCity.trim()) nextErrors.fromCity = t.errorFieldFromCity;
      if (!toCity.trim()) nextErrors.toCity = t.errorFieldToCity;
    } else if (currentStep === 4) {
      if (selectedDateStr === null) nextErrors.date = t.errorFieldDate;
    } else if (currentStep === 5) {
      if (postType === "traveler" && weightKg === 0 && weightLuggage === 0) {
        nextErrors.weight = t.errorFieldWeight;
      }
    } else if (currentStep === 6) {
      if (!note.trim()) nextErrors.note = t.errorFieldNote;
      if (!contact.trim()) {
        nextErrors.contact = t.errorFieldContact;
      } else {
        const normalized = contactMethod === "telegram"
          ? (contact.trim().startsWith("@") ? contact.trim() : `@${contact.trim()}`)
          : contact.trim().replace(/^@/, "");
        if (!isValidContact(normalized, contactMethod)) {
          nextErrors.contact = contactMethod === "telegram"
            ? t.errorContactTelegram
            : t.errorContactPhone;
        }
      }
    }

    setErrors(nextErrors);

    const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstInvalid) {
      const el = fieldRefs.current[firstInvalid];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus({ preventScroll: true });
      }
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(s => Math.min(6, s + 1));
    }
  };

  const handleBack = () => {
    setStep(s => Math.max(1, s - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (honeypot.trim() !== "") {
      console.warn("Spam detected: Bot submitted honeypot field.");
      return;
    }

    setSubmitError(null);

    // Validate the final step just in case
    if (!validateStep(6)) return;

    setSubmitting(true);

    try {
      const dateString = selectedDateStr;
      let finalWeight: string;
      if (postType === "traveler") {
        finalWeight = buildWeightString(weightKg, weightLuggage);
      } else {
        const labels = selectedItems
          .map(id => itemTypes.find(it => it.id === id)?.label)
          .filter((l): l is string => Boolean(l));
        if (customItemType.trim()) labels.push(customItemType.trim());
        const catStr = labels.join(", ");
        const kgStr = weightKg > 0 ? `${weightKg} kg` : "";
        finalWeight = [kgStr, catStr].filter(Boolean).join(" · ") || catStr || "Jo'natma";
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
        from_country: fromCountry,
        to_country: toCountry,
        from_city: fromCity.trim(),
        to_city: toCity.trim(),
        date: dateString,
        weight_kg: weightKg,
        luggage_count: postType === "traveler" ? weightLuggage : 0,
        categories: postType === "request" ? selectedItems : [],
        category_other: postType === "request" ? customItemType.trim() || null : null,
        weight: finalWeight,
        note: note.trim(),
        contact: finalContact,
        contact_type: contactMethod,
        contact2: finalContact2,
        contact2_type: finalContact2 ? contact2Method : null,
        honeypot: honeypot
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

  const stepTitles = [
    t.stepAdType,
    t.stepRoute,
    t.stepCities,
    t.stepDate,
    t.stepCargo,
    t.stepContact
  ];

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
        className="bg-card w-full max-w-[560px] rounded-t-2xl px-6 pt-4 pb-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative outline-none flex flex-col"
      >
        <div className="w-10 h-1 bg-field rounded-full mx-auto mb-5" aria-hidden="true"></div>

        <button
          onClick={onClose}
          aria-label={t.closeLabel || "Yopish"}
          className="absolute right-[18px] top-[18px] bg-paper border-none w-8 h-8 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-rule transition-colors z-10"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="flex flex-col gap-2 mb-6 mt-2">
          <div className="flex justify-between items-center text-[10.5px] font-bold text-faint">
            <span className="uppercase tracking-wider">{step}-BOSQICH: {stepTitles[step - 1]}</span>
            <span>{step}/6</span>
          </div>
          <div className="h-1.5 bg-edge rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ease-out ${postType === 'traveler' ? 'bg-blue' : 'bg-red'}`} 
              style={{ width: `${(step / 6) * 100}%` }}
            ></div>
          </div>
        </div>

        <h2 id="post-form-title" className="text-2xl font-extrabold text-ink tracking-tight mb-6">
          {stepTitles[step - 1]}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <input 
            type="text" 
            name="website" 
            value={honeypot} 
            onChange={(e) => setHoneypot(e.target.value)} 
            style={{ display: "none" }} 
            tabIndex={-1} 
            autoComplete="off" 
          />

          {step === 1 && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setPostType("traveler")}
                className={`p-4 rounded-xl border-[1.5px] text-left transition-all group ${
                  postType === "traveler"
                    ? "border-blue bg-blue/[0.03]"
                    : "border-edge hover:border-blue/50"
                }`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className={`p-2 rounded-lg transition-colors ${postType === 'traveler' ? 'bg-blue text-card shadow-sm' : 'bg-paper text-faint group-hover:bg-blue/10 group-hover:text-blue'}`}>
                    <Plane className="w-5 h-5" />
                  </div>
                  <span className={`font-bold text-lg transition-colors ${postType === 'traveler' ? 'text-blue' : 'text-ink'}`}>{t.tabTraveler}</span>
                </div>
                <p className="text-sm text-faint ml-[44px]">{t.subtravelerDesc}</p>
              </button>

              <button
                type="button"
                onClick={() => setPostType("request")}
                className={`p-4 rounded-xl border-[1.5px] text-left transition-all group ${
                  postType === "request"
                    ? "border-red bg-red/[0.03]"
                    : "border-edge hover:border-red/50"
                }`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className={`p-2 rounded-lg transition-colors ${postType === 'request' ? 'bg-red text-card shadow-sm' : 'bg-paper text-faint group-hover:bg-red/10 group-hover:text-red'}`}>
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <span className={`font-bold text-lg transition-colors ${postType === 'request' ? 'text-red' : 'text-ink'}`}>{t.tabRequest}</span>
                </div>
                <p className="text-sm text-faint ml-[44px]">{t.subrequestDesc}</p>
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
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
            </div>
          )}

          {step === 3 && (
            <div>
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
          )}

          {step === 4 && (
            <div ref={(el) => { fieldRefs.current.date = el; }}>
              <label className="block font-mono text-[10.5px] tracking-wider uppercase text-blue font-bold mb-2">
                {postType === "traveler" ? t.dateLabelTraveler : t.dateLabelRequest}
              </label>
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {daysList.map(d => {
                    const dStr = formatDateStr(d);
                    const isSelected = dStr === selectedDateStr;
                    return (
                      <button
                        key={dStr}
                        type="button"
                        onClick={() => { setSelectedDateStr(dStr); clearError("date"); }}
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
              </div>
              <FieldError message={errors.date} />
            </div>
          )}

          {step === 5 && (
            <div>
              <label className="block font-mono text-[10.5px] tracking-wider uppercase text-blue font-bold mb-2">
                {postType === "traveler" ? t.weightLabelTraveler : t.weightLabelRequest}
              </label>

              {postType === "traveler" ? (
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
          )}

          {step === 6 && (
            <>
              <div>
                <label className="block font-mono text-[10.5px] tracking-wider uppercase text-blue font-bold mb-1.5">
                  {t.noteLabel.replace(" (ixtiyoriy)", "")} <span className="text-red-500">*</span>
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

              <ContactFields
                t={t}
                label={<>{t.contactLabel} <span className="text-red-500">*</span></>}
                method={contactMethod}
                onMethodChange={(next) => {
                  setContactMethod(next);
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
            </>
          )}

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-edge">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 py-3.5 bg-paper text-ink border border-field rounded-lg font-bold text-base hover:bg-rule transition-colors"
              >
                {t.btnBack}
              </button>
            )}
            
            {step < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                className={`flex-[2] py-3.5 text-card border-none rounded-lg font-bold text-base transition-colors ${
                  postType === "traveler"
                    ? "bg-blue hover:bg-[#355CA8]"
                    : "bg-red hover:bg-[#D04A4A]"
                }`}
              >
                {t.btnNext}
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className={`flex-[2] py-3.5 text-card border-none rounded-lg font-bold text-base transition-colors ${
                  postType === "traveler"
                    ? "bg-blue hover:bg-[#355CA8]"
                    : "bg-red hover:bg-[#D04A4A]"
                }`}
              >
                {submitting ? t.submittingBtn : t.submitBtn}
              </button>
            )}
          </div>

          {step === 6 && (
            <div className="text-center font-mono text-[10.5px] text-faint">
              {t.autoDeleteLabel}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
