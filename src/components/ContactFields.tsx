import React from "react";
import { Phone, Send, AlertCircle, X } from "lucide-react";
import { ContactMethod, Translations } from "../types";

// Phone fields keep digits and the punctuation used by the +998/+82 formats
// in the placeholder; letters and everything else are dropped as the user types.
export const sanitizePhone = (value: string) => value.replace(/[^\d+\-\s()]/g, "");

const ERROR_INPUT_CLASS = "border-red focus:border-red ring-1 ring-red/30";

export interface ContactFieldsProps {
  t: Translations;
  primaryMethod: ContactMethod;
  onPrimaryMethodChange: (method: ContactMethod) => void;
  telegram: string;
  onTelegramChange: (val: string) => void;
  phone1: string;
  onPhone1Change: (val: string) => void;
  phone2: string;
  onPhone2Change: (val: string) => void;
  showPhone1: boolean;
  onShowPhone1Change: (show: boolean) => void;
  showPhone2: boolean;
  onShowPhone2Change: (show: boolean) => void;
  showTelegram: boolean;
  onShowTelegramChange: (show: boolean) => void;
  primaryError?: string;
  phone1Error?: string;
  phone2Error?: string;
  telegramError?: string;
  primaryInputRef?: (el: HTMLInputElement | null) => void;
  label?: React.ReactNode;
}

const PhoneShortcuts: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => (
  <div className="mt-1.5 flex flex-wrap gap-1.5">
    <button
      type="button"
      onClick={() => {
        if (!value.startsWith("+998")) {
          onChange("+998 " + value.replace(/^\+?\d*/, "").trim());
        }
      }}
      className="font-mono text-[10px] px-2 py-0.5 bg-emerald-50 text-green border border-emerald-100 rounded hover:bg-emerald-100 transition-all"
    >
      🇺🇿 +998
    </button>
    <button
      type="button"
      onClick={() => {
        if (!value.startsWith("+82")) {
          onChange("+82 " + value.replace(/^\+?\d*/, "").trim());
        }
      }}
      className="font-mono text-[10px] px-2 py-0.5 bg-emerald-50 text-green border border-emerald-100 rounded hover:bg-emerald-100 transition-all"
    >
      🇰🇷 +82
    </button>
  </div>
);

const TelegramPreview: React.FC<{ handle: string }> = ({ handle }) => {
  const clean = handle.trim().replace(/^@/, "");
  if (!clean) return null;
  return (
    <div className="mt-1.5 font-mono text-[10.5px] text-blue flex items-center gap-1.5 bg-[#E8EEF8]/60 px-2.5 py-1.5 rounded-md border border-[#D5E2F4] w-fit">
      <Send className="w-3 h-3" />
      <span className="opacity-90">Telegram havola:</span>
      <a
        href={`https://t.me/${clean}`}
        target="_blank"
        rel="noreferrer"
        className="underline text-gold-deep font-bold hover:text-ink tracking-tight"
      >
        t.me/{clean}
      </a>
    </div>
  );
};

export const ContactFields: React.FC<ContactFieldsProps> = ({
  t,
  primaryMethod,
  onPrimaryMethodChange,
  telegram,
  onTelegramChange,
  phone1,
  onPhone1Change,
  phone2,
  onPhone2Change,
  showPhone1,
  onShowPhone1Change,
  showPhone2,
  onShowPhone2Change,
  showTelegram,
  onShowTelegramChange,
  primaryError,
  phone1Error,
  phone2Error,
  telegramError,
  primaryInputRef,
  label,
}) => {
  const isPrimaryTg = primaryMethod === "telegram";
  const primaryHandle = telegram.trim().replace(/^@/, "");

  return (
    <div className="flex flex-col gap-4">
      {/* Primary Contact Block */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block font-mono text-[10.5px] tracking-wider uppercase text-blue font-bold">
            {label || t.contactLabel}
          </label>

          <div className="flex bg-paper border border-edge rounded-lg p-0.5 gap-0.5 scale-[0.9] origin-right">
            <button
              type="button"
              onClick={() => onPrimaryMethodChange("telegram")}
              className={`px-3 py-1 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                isPrimaryTg
                  ? "bg-blue text-white shadow-sm"
                  : "text-body hover:text-ink"
              }`}
            >
              <Send className="w-2.5 h-2.5" />
              Telegram
            </button>
            <button
              type="button"
              onClick={() => onPrimaryMethodChange("phone")}
              className={`px-3 py-1 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                !isPrimaryTg
                  ? "bg-green text-white shadow-sm"
                  : "text-body hover:text-ink"
              }`}
            >
              <Phone className="w-2.5 h-2.5" />
              Telefon
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-faint">
            {isPrimaryTg ? (
              <span className="font-mono text-sm font-bold text-blue mr-0.5">@</span>
            ) : (
              <Phone className="w-4 h-4 text-green" />
            )}
          </div>

          {isPrimaryTg ? (
            <input
              type="text"
              ref={primaryInputRef}
              inputMode="text"
              value={telegram.startsWith("@") ? telegram.substring(1) : telegram}
              onChange={(e) => {
                const typed = e.target.value;
                onTelegramChange(typed.startsWith("@") ? typed : "@" + typed);
              }}
              placeholder="username"
              maxLength={99}
              className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-card text-ink font-mono transition-all border-field focus:border-blue focus:ring-1 focus:ring-blue ${
                primaryError ? ERROR_INPUT_CLASS : ""
              }`}
              style={{ paddingLeft: "34px" }}
            />
          ) : (
            <input
              type="text"
              ref={primaryInputRef}
              inputMode="tel"
              value={phone1}
              onChange={(e) => onPhone1Change(sanitizePhone(e.target.value))}
              placeholder="+998 90-123-4567 yoki +82 10-1234-5678"
              maxLength={100}
              className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-card text-ink font-mono transition-all border-field focus:border-green focus:ring-1 focus:ring-green ${
                primaryError ? ERROR_INPUT_CLASS : ""
              }`}
              style={{ paddingLeft: "34px" }}
            />
          )}
        </div>

        {primaryError && (
          <p className="mt-1.5 flex items-center gap-1.5 text-red text-[12px] font-semibold">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {primaryError}
          </p>
        )}

        {isPrimaryTg ? (
          <TelegramPreview handle={primaryHandle} />
        ) : (
          <PhoneShortcuts value={phone1} onChange={onPhone1Change} />
        )}
      </div>

      {/* Secondary Contacts Section */}
      {isPrimaryTg ? (
        <>
          {/* When Primary is Telegram: Optional Phone 1 and Optional Phone 2 */}
          {showPhone1 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-mono text-[10.5px] tracking-wider uppercase text-blue font-bold">
                  {t.secondaryContactLabel || "Telefon raqam"}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    onShowPhone1Change(false);
                    onPhone1Change("");
                  }}
                  className="text-faint hover:text-red p-1"
                  aria-label={t.deleteBtn || "O'chirish"}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-faint">
                  <Phone className="w-4 h-4 text-green" />
                </div>
                <input
                  type="text"
                  inputMode="tel"
                  value={phone1}
                  onChange={(e) => onPhone1Change(sanitizePhone(e.target.value))}
                  placeholder="+998 90-123-4567 yoki +82 10-1234-5678"
                  maxLength={100}
                  className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-card text-ink font-mono border-field focus:border-green focus:ring-1 focus:ring-green ${
                    phone1Error ? ERROR_INPUT_CLASS : ""
                  }`}
                  style={{ paddingLeft: "34px" }}
                />
              </div>
              {phone1Error && (
                <p className="mt-1.5 flex items-center gap-1.5 text-red text-[12px] font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {phone1Error}
                </p>
              )}
              <PhoneShortcuts value={phone1} onChange={onPhone1Change} />
            </div>
          )}

          {showPhone2 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-mono text-[10.5px] tracking-wider uppercase text-blue font-bold">
                  {t.secondPhoneLabel || "2-telefon raqam"}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    onShowPhone2Change(false);
                    onPhone2Change("");
                  }}
                  className="text-faint hover:text-red p-1"
                  aria-label={t.deleteBtn || "O'chirish"}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-faint">
                  <Phone className="w-4 h-4 text-green" />
                </div>
                <input
                  type="text"
                  inputMode="tel"
                  value={phone2}
                  onChange={(e) => onPhone2Change(sanitizePhone(e.target.value))}
                  placeholder="+998 90-123-4567 yoki +82 10-1234-5678"
                  maxLength={100}
                  className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-card text-ink font-mono border-field focus:border-green focus:ring-1 focus:ring-green ${
                    phone2Error ? ERROR_INPUT_CLASS : ""
                  }`}
                  style={{ paddingLeft: "34px" }}
                />
              </div>
              {phone2Error && (
                <p className="mt-1.5 flex items-center gap-1.5 text-red text-[12px] font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {phone2Error}
                </p>
              )}
              <PhoneShortcuts value={phone2} onChange={onPhone2Change} />
            </div>
          )}

          {/* Buttons to add secondary phones when Primary is Telegram */}
          <div className="flex flex-wrap gap-2">
            {!showPhone1 && (
              <button
                type="button"
                onClick={() => onShowPhone1Change(true)}
                className="font-mono text-xs font-semibold px-4 py-2.5 bg-card text-body border border-dashed border-field rounded-lg hover:border-ink hover:text-ink transition-all"
              >
                {t.addPhoneBtn || "+ Telefon raqam qo'shish"}
              </button>
            )}
            {showPhone1 && !showPhone2 && (
              <button
                type="button"
                onClick={() => onShowPhone2Change(true)}
                className="font-mono text-xs font-semibold px-4 py-2.5 bg-card text-body border border-dashed border-field rounded-lg hover:border-ink hover:text-ink transition-all"
              >
                {t.addSecondPhoneBtn || "+ Qo'shimcha telefon"}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {/* When Primary is Phone: Optional Telegram and Optional Phone 2 */}
          {showTelegram && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-mono text-[10.5px] tracking-wider uppercase text-blue font-bold">
                  Telegram
                </label>
                <button
                  type="button"
                  onClick={() => {
                    onShowTelegramChange(false);
                    onTelegramChange("");
                  }}
                  className="text-faint hover:text-red p-1"
                  aria-label={t.deleteBtn || "O'chirish"}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-faint">
                  <span className="font-mono text-sm font-bold text-blue mr-0.5">@</span>
                </div>
                <input
                  type="text"
                  value={telegram.startsWith("@") ? telegram.substring(1) : telegram}
                  onChange={(e) => {
                    const typed = e.target.value;
                    onTelegramChange(typed.startsWith("@") ? typed : "@" + typed);
                  }}
                  placeholder="username"
                  maxLength={99}
                  className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-card text-ink font-mono border-field focus:border-blue focus:ring-1 focus:ring-blue ${
                    telegramError ? ERROR_INPUT_CLASS : ""
                  }`}
                  style={{ paddingLeft: "34px" }}
                />
              </div>
              {telegramError && (
                <p className="mt-1.5 flex items-center gap-1.5 text-red text-[12px] font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {telegramError}
                </p>
              )}
              <TelegramPreview handle={telegram} />
            </div>
          )}

          {showPhone2 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-mono text-[10.5px] tracking-wider uppercase text-blue font-bold">
                  {t.secondPhoneLabel || "Qo'shimcha telefon"}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    onShowPhone2Change(false);
                    onPhone2Change("");
                  }}
                  className="text-faint hover:text-red p-1"
                  aria-label={t.deleteBtn || "O'chirish"}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-faint">
                  <Phone className="w-4 h-4 text-green" />
                </div>
                <input
                  type="text"
                  inputMode="tel"
                  value={phone2}
                  onChange={(e) => onPhone2Change(sanitizePhone(e.target.value))}
                  placeholder="+998 90-123-4567 yoki +82 10-1234-5678"
                  maxLength={100}
                  className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-card text-ink font-mono border-field focus:border-green focus:ring-1 focus:ring-green ${
                    phone2Error ? ERROR_INPUT_CLASS : ""
                  }`}
                  style={{ paddingLeft: "34px" }}
                />
              </div>
              {phone2Error && (
                <p className="mt-1.5 flex items-center gap-1.5 text-red text-[12px] font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {phone2Error}
                </p>
              )}
              <PhoneShortcuts value={phone2} onChange={onPhone2Change} />
            </div>
          )}

          {/* Buttons to add secondary contacts when Primary is Phone */}
          <div className="flex flex-wrap gap-2">
            {!showTelegram && (
              <button
                type="button"
                onClick={() => onShowTelegramChange(true)}
                className="font-mono text-xs font-semibold px-4 py-2.5 bg-card text-body border border-dashed border-field rounded-lg hover:border-ink hover:text-ink transition-all"
              >
                {t.addTelegramBtn || "+ Telegram qo'shish"}
              </button>
            )}
            {!showPhone2 && (
              <button
                type="button"
                onClick={() => onShowPhone2Change(true)}
                className="font-mono text-xs font-semibold px-4 py-2.5 bg-card text-body border border-dashed border-field rounded-lg hover:border-ink hover:text-ink transition-all"
              >
                {t.addSecondPhoneBtn || "+ Qo'shimcha telefon"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
