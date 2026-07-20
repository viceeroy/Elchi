import React, { useState } from "react";
import { Locale, Translations, PostType } from "../types";
import { X, Briefcase, Package, Sparkles, Phone, Send } from "lucide-react";

// Phone fields keep digits and the punctuation used by the +998/+82 formats
// in the placeholder; letters and everything else are dropped as the user types.
const sanitizePhone = (value: string) => value.replace(/[^\d+\-\s()]/g, "");

interface PostFormModalProps {
  t: Translations;
  locale: Locale;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export const PostFormModal: React.FC<PostFormModalProps> = ({
  t,
  locale,
  onClose,
  onSubmitSuccess,
}) => {
  const [postType, setPostType] = useState<PostType>("traveler");
  const [direction, setDirection] = useState<"k2u" | "u2k">("k2u");
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

  const itemTypes = [
    { id: "docs", label: locale === "uz" ? "Hujjatlar" : locale === "ru" ? "Документы" : "Documents" },
    { id: "clothes", label: locale === "uz" ? "Kiyim-kechak" : locale === "ru" ? "Одежда" : "Clothes" },
    { id: "meds", label: locale === "uz" ? "Dori-darmon" : locale === "ru" ? "Лекарства" : "Medicines" },
    { id: "food", label: locale === "uz" ? "Oziq-ovqat" : locale === "ru" ? "Продукты" : "Food" },
    { id: "phone", label: locale === "uz" ? "Telefon/Texnika" : locale === "ru" ? "Телефон/Техника" : "Phone/Gadget" },
    { id: "gift", label: locale === "uz" ? "Sovg'a" : locale === "ru" ? "Подарок" : "Gift" },
    { id: "other", label: locale === "uz" ? "Boshqa" : locale === "ru" ? "Другое" : "Other" },
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
    { value: today.getMonth(), label: locale === "uz" ? "Ushbu oy" : locale === "ru" ? "Этот месяц" : "This Month" },
    { value: nextMonth, label: locale === "uz" ? "Keyingi oy" : locale === "ru" ? "Следующий месяц" : "Next Month" },
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

    // 2. Client-side Validation
    if (!fromCity.trim() || !toCity.trim()) {
      alert(t.errorRequiredFields + " (Qaysi shahar / City)");
      return;
    }

    if (selectedDay === null) {
      alert(t.errorRequiredFields + " (Sana / Date)");
      return;
    }

    if (postType === "traveler" && weightKg === 0 && weightLuggage === 0) {
      alert(t.errorRequiredFields + " (Kg yoki chamadon / Weight or luggage)");
      return;
    }

    if (postType === "request" && selectedItems.length === 0) {
      alert(t.errorRequiredFields + " (Nima yubormoqchisiz? / Category)");
      return;
    }

    if (!note.trim()) {
      alert(t.errorRequiredFields + " (Izoh / Note)");
      return;
    }

    if (!contact.trim()) {
      alert(t.errorRequiredFields + " (Bog'lanish / Contact)");
      return;
    }

    setSubmitting(true);

    try {
      // Build ISO Date string (YYYY-MM-DD)
      const dateString = `${currentYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;

      // Build Weight representation. 0 kg is valid: for a traveler it means
      // luggage-only (no per-kg space), for a request it drops the weight suffix.
      // The luggage word is stored as a neutral "chamadon" token regardless of the
      // author's locale — BoardingPass/App re-localize it at render time based on
      // the viewer's current locale, so it doesn't freeze to whatever language the
      // post was created in.
      let finalWeight: string;
      if (postType === "traveler") {
        const parts: string[] = [];
        if (weightKg > 0) parts.push(`${weightKg} kg`);
        if (weightLuggage > 0) parts.push(`${weightLuggage} chamadon`);
        finalWeight = parts.join(" + ") || "0 kg";
      } else {
        // Categories: comma-joined labels ("other" uses the custom text if given).
        // Weight string = "<kg> · <categories>"; the card shows only the kg part
        // (0 kg hidden), the detail modal shows the full string incl. categories.
        const labels = selectedItems
          .map(id => id === "other" ? (customItemType.trim() || "Boshqa") : itemTypes.find(it => it.id === id)?.label)
          .filter((l): l is string => Boolean(l));
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
        from_city: fromCity.trim(),
        to_city: toCity.trim(),
        date: dateString,
        weight: finalWeight,
        note: note.trim(),
        contact: finalContact,
        contact2: finalContact2,
        honeypot: honeypot // Passed so backend can verify as well
      };

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });

      const result = await res.json();

      if (res.ok) {
        onSubmitSuccess();
      } else {
        alert(result.error || t.errorGeneral);
      }
    } catch (err) {
      console.error(err);
      alert(t.errorGeneral);
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

  const luggageWordLabel = weightLuggage === 1 
    ? (locale === "uz" ? "chamadon" : locale === "ru" ? "чемодан" : "bag") 
    : (locale === "uz" ? "ta chamadon" : locale === "ru" ? "чемодана" : "bags");

  const weekdays = ["Ya","Du","Se","Ch","Pa","Ju","Sh"];

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

        {/* Header Title & Subtitle */}
        <h2 className="text-2xl font-extrabold text-[#1B2A4A] tracking-tight mb-1">{t.addPostTitle}</h2>
        <div className="text-[13.5px] text-[#6B7280] leading-relaxed mb-6">
          {postType === "traveler" ? t.addPostSubTraveler : t.addPostSubRequest}
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

          {/* Route Section with Direction Toggle and Dropdowns */}
          <div>
            <label className="block font-mono text-[10.5px] tracking-wider uppercase text-[#2A4B8D] font-bold mb-3">
              {t.fromToLabel}
            </label>
            
            {/* Direction Toggle */}
            <div className="flex bg-[#F2EFE6] border border-[#E9E5D8] rounded-xl p-1 mb-4 gap-1">
              <button 
                type="button" 
                onClick={() => setDirection("k2u")}
                className={`flex-1 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  direction === "k2u" 
                    ? "bg-[#2A4B8D] text-white shadow" 
                    : "text-[#5A6272] hover:text-[#1B2A4A]"
                }`}
              >
                {t.koreaToUzbekistan}
              </button>
              <button 
                type="button" 
                onClick={() => setDirection("u2k")}
                className={`flex-1 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  direction === "u2k" 
                    ? "bg-[#C23B3B] text-white shadow" 
                    : "text-[#5A6272] hover:text-[#1B2A4A]"
                }`}
              >
                {t.uzbekistanToKorea}
              </button>
            </div>

            {/* Free-text From / To cities */}
            <div className="flex flex-row items-end gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-bold text-[#8A8F98] tracking-wider uppercase mb-1.5">
                  {locale === "uz" ? "Qaysi shahardan" : locale === "ru" ? "Из какого города" : "From which city"}
                </label>
                <input
                  type="text"
                  value={fromCity}
                  onChange={(e) => setFromCity(e.target.value)}
                  placeholder={locale === "uz" ? "Qayerdan (masalan: Seoul)" : locale === "ru" ? "Откуда (напр.: Сеул)" : "From (e.g. Seoul)"}
                  className="w-full box-sizing-border-box p-3 border border-[#D8D3C4] rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] focus:border-[#2A4B8D] outline-none"
                />
              </div>

              <span className="flex items-center justify-center text-[#C79A3E] font-bold text-lg pb-2.5 flex-shrink-0">➔</span>

              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-bold text-[#8A8F98] tracking-wider uppercase mb-1.5">
                  {locale === "uz" ? "Qaysi shaharga" : locale === "ru" ? "В какой город" : "To which city"}
                </label>
                <input
                  type="text"
                  value={toCity}
                  onChange={(e) => setToCity(e.target.value)}
                  placeholder={locale === "uz" ? "Qayerga (masalan: Toshkent)" : locale === "ru" ? "Куда (напр.: Ташкент)" : "To (e.g. Tashkent)"}
                  className="w-full box-sizing-border-box p-3 border border-[#D8D3C4] rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] focus:border-[#2A4B8D] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Date Selection Section */}
          <div>
            <label className="block font-mono text-[10.5px] tracking-wider uppercase text-[#2A4B8D] font-bold mb-2">
              {postType === "traveler" ? t.dateLabelTraveler : t.dateLabelRequest}
            </label>
            <div className="flex flex-col gap-3">
              {/* Month Tabs */}
              <div className="flex gap-2">
                {monthOptions.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => { setSelectedMonth(m.value); setSelectedDay(null); }}
                    className={`font-mono text-xs px-3.5 py-1.5 border-none rounded-full font-bold cursor-pointer transition-colors ${
                      selectedMonth === m.value 
                        ? "bg-[#1B2A4A] text-[#FCFBF6]" 
                        : "bg-[#F2EFE6] text-[#6B7280] hover:bg-[#E4E0D2]"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Horizontal Days Selector */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {daysList.map(d => {
                  const isSelected = d.getDate() === selectedDay;
                  return (
                    <button
                      key={d.getDate()}
                      type="button"
                      onClick={() => setSelectedDay(d.getDate())}
                      className={`font-mono flex flex-col items-center gap-0.5 min-w-[42px] p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected 
                          ? "bg-[#1B2A4A] text-[#FCFBF6] border-[#1B2A4A] scale-105 shadow-sm" 
                          : "bg-[#FCFBF6] text-[#1B2A4A] border-[#E4E0D2] hover:border-[#1B2A4A]"
                      }`}
                    >
                      <span className="text-[9px] opacity-65">{weekdays[d.getDay()]}</span>
                      <span className="text-15px font-bold">{d.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Weight & Category Section */}
          <div>
            <label className="block font-mono text-[10.5px] tracking-wider uppercase text-[#2A4B8D] font-bold mb-2">
              {postType === "traveler" ? t.weightLabelTraveler : t.weightLabelRequest}
            </label>

            {postType === "traveler" ? (
              // Traveler: Weight Stepper + Suitcase Option
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3.5 bg-[#F2EFE6] border border-[#E9E5D8] rounded-xl p-2.5">
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
                    onClick={() => setWeightKg(w => Math.min(40, w + 1))}
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
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setWeightLuggage(1)}
                      className="font-mono text-xs font-semibold px-4 py-3 bg-[#FCFBF6] text-[#6B7280] border border-dashed border-[#D8D3C4] rounded-lg hover:border-[#1B2A4A]"
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

                {selectedItems.includes("other") && (
                  <input
                    type="text"
                    value={customItemType}
                    onChange={(e) => setCustomItemType(e.target.value)}
                    placeholder={t.itemTypeOtherPlaceholder}
                    className="w-full box-sizing-border-box padding-12px-14px border-1.5px-solid border-[#D8D3C4] rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A]"
                    style={{ padding: "10px 14px", border: "1.5px solid #D8D3C4", borderRadius: "8px" }}
                  />
                )}

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
          </div>

          {/* Note/Izoh — required */}
          <div>
            <label className="block font-mono text-[10.5px] tracking-wider uppercase text-[#2A4B8D] font-bold mb-1.5">
              {t.noteLabel.replace(" (ixtiyoriy)", "").replace(" (опционально)", "").replace(" (optional)", "")} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
              className="w-full box-sizing-border-box p-3 border border-[#D8D3C4] rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] resize-y min-h-[72px]"
            ></textarea>
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
                    {locale === "uz" ? "Telefon" : locale === "ru" ? "Телефон" : "Phone"}
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
                  }}
                  placeholder={
                    contactMethod === "telegram" 
                      ? "username" 
                      : locale === "uz" ? "+998 90-123-4567 yoki +82 10-1234-5678" : locale === "ru" ? "+998 90-123-4567 или +82 10-1234-5678" : "+998 90-123-4567 or +82 10-1234-5678"
                  }
                  required
                  className={`w-full box-sizing-border-box p-3 pl-8.5 border rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] font-mono transition-all ${
                    contactMethod === "telegram" 
                      ? "border-[#D8D3C4] focus:border-[#2A4B8D] focus:ring-1 focus:ring-[#2A4B8D]" 
                      : "border-[#D8D3C4] focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  }`}
                  style={{ paddingLeft: "34px" }}
                />
              </div>

              {/* Dynamic Helper Link or Country Code Suggestions */}
              {contactMethod === "telegram" ? (
                contact.trim().replace("@", "") && (
                  <div className="mt-1.5 font-mono text-[10.5px] text-[#2A4B8D] flex items-center gap-1.5 bg-[#E8EEF8]/60 px-2.5 py-1.5 rounded-md border border-[#D5E2F4] w-fit">
                    <Send className="w-3 h-3" />
                    <span className="opacity-75">{locale === "uz" ? "Telegram havola:" : locale === "ru" ? "Ссылка Telegram:" : "Telegram link:"}</span>
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
                    className="text-[#8A8F98] hover:text-[#C23B3B] text-[11px] font-mono font-bold"
                  >
                    ✕
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
                        ? (locale === "uz" ? "+998 90-123-4567 yoki +82 10-1234-5678" : locale === "ru" ? "+998 90-123-4567 или +82 10-1234-5678" : "+998 90-123-4567 or +82 10-1234-5678")
                        : "username"
                    }
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
export default PostFormModal;
