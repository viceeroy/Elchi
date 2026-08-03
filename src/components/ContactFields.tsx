import React from "react";
import { Phone, Send, AlertCircle, X } from "lucide-react";
import { ContactMethod, Translations } from "../types";

// Phone fields keep digits and the punctuation used by the +998/+82 formats
// in the placeholder; letters and everything else are dropped as the user types.
export const sanitizePhone = (value: string) => value.replace(/[^\d+\-\s()]/g, "");

const ERROR_INPUT_CLASS =
  "border-[#C23B3B] focus:border-[#C23B3B] ring-1 ring-[#C23B3B]/30";

interface ContactFieldsProps {
  t: Translations;
  method: ContactMethod;
  onMethodChange: (method: ContactMethod) => void;
  contact: string;
  onContactChange: (value: string) => void;
  contact2: string;
  onContact2Change: (value: string) => void;
  showContact2: boolean;
  onShowContact2Change: (show: boolean) => void;
  error?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
  // Overrides the section label. Used by the note sheet, where the contact is
  // optional and the label has to say so.
  label?: string;
}

/**
 * The contact block: a Telegram/phone toggle, the primary handle, and an
 * optional second handle on the opposite channel.
 *
 * Telegram handles are always held in state with the leading "@" even though
 * the input renders without it, so the stored value matches what the API
 * validates (see lib/contact.ts). The secondary field is always the opposite
 * channel of the primary — two Telegram usernames would be redundant.
 *
 * Currently used by the announcement sheet; PostFormModal still carries its
 * own copy of this markup and can adopt this component later.
 */
export const ContactFields: React.FC<ContactFieldsProps> = ({
  t,
  method,
  onMethodChange,
  contact,
  onContactChange,
  contact2,
  onContact2Change,
  showContact2,
  onShowContact2Change,
  error,
  inputRef,
  label,
}) => {
  const handle = contact.trim().replace("@", "");

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block font-mono text-[10.5px] tracking-wider uppercase text-[#2A4B8D] font-bold">
            {label || t.contactLabel}
          </label>

          <div className="flex bg-[#F2EFE6] border border-[#E9E5D8] rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => onMethodChange("telegram")}
              className={`px-3 py-1 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                method === "telegram"
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
                onMethodChange("phone");
                if (contact.startsWith("@")) onContactChange(contact.replace("@", ""));
              }}
              className={`px-3 py-1 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                method === "phone"
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
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[#8A8F98]">
            {method === "telegram" ? (
              <span className="font-mono text-sm font-bold text-[#2A4B8D] mr-0.5">@</span>
            ) : (
              <Phone className="w-4 h-4 text-emerald-600" />
            )}
          </div>

          <input
            type="text"
            ref={inputRef}
            inputMode={method === "phone" ? "tel" : "text"}
            value={method === "telegram" && contact.startsWith("@") ? contact.substring(1) : contact}
            onChange={(e) => {
              const typed = e.target.value;
              if (method === "telegram") {
                onContactChange(typed.startsWith("@") ? typed : "@" + typed);
              } else {
                onContactChange(sanitizePhone(typed));
              }
            }}
            placeholder={
              method === "telegram"
                ? "username"
                : "+998 90-123-4567 yoki +82 10-1234-5678"
            }
            maxLength={method === "telegram" ? 99 : 100}
            className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] font-mono transition-all ${
              error
                ? ERROR_INPUT_CLASS
                : method === "telegram"
                  ? "border-[#D8D3C4] focus:border-[#2A4B8D] focus:ring-1 focus:ring-[#2A4B8D]"
                  : "border-[#D8D3C4] focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            }`}
            style={{ paddingLeft: "34px" }}
          />
        </div>

        {error && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[#C23B3B] text-[12px] font-semibold">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </p>
        )}

        {/* Live preview of the t.me link, or country-code shortcuts for phones */}
        {method === "telegram" ? (
          handle && (
            <div className="mt-1.5 font-mono text-[10.5px] text-[#2A4B8D] flex items-center gap-1.5 bg-[#E8EEF8]/60 px-2.5 py-1.5 rounded-md border border-[#D5E2F4] w-fit">
              <Send className="w-3 h-3" />
              <span className="opacity-75">Telegram havola:</span>
              <a
                href={`https://t.me/${handle}`}
                target="_blank"
                rel="noreferrer"
                className="underline text-[#C79A3E] font-bold hover:text-[#1B2A4A] tracking-tight"
              >
                t.me/{handle}
              </a>
            </div>
          )
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!contact.startsWith("+998")) {
                  onContactChange("+998 " + contact.replace(/^\+?\d*/, "").trim());
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
                  onContactChange("+82 " + contact.replace(/^\+?\d*/, "").trim());
                }
              }}
              className="font-mono text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded hover:bg-emerald-100 transition-all"
            >
              🇰🇷 +82
            </button>
          </div>
        )}
      </div>

      {/* Secondary contact — always the opposite channel of the primary */}
      <div>
        {showContact2 ? (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-mono text-[10.5px] tracking-wider uppercase text-[#2A4B8D] font-bold">
                {t.secondaryContactLabel || "Qo'shimcha bog'lanish"}
              </label>
              <button
                type="button"
                onClick={() => {
                  onShowContact2Change(false);
                  onContact2Change("");
                }}
                className="text-[#8A8F98] hover:text-[#C23B3B]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[#8A8F98]">
                {method === "telegram" ? (
                  <Phone className="w-4 h-4 text-emerald-600" />
                ) : (
                  <span className="font-mono text-sm font-bold text-[#2A4B8D] mr-0.5">@</span>
                )}
              </div>
              <input
                type="text"
                inputMode={method === "telegram" ? "tel" : "text"}
                value={contact2}
                onChange={(e) => {
                  const typed = e.target.value;
                  onContact2Change(method === "telegram" ? sanitizePhone(typed) : typed);
                }}
                placeholder={
                  method === "telegram"
                    ? "+998 90-123-4567 yoki +82 10-1234-5678"
                    : "username"
                }
                maxLength={method === "telegram" ? 100 : 99}
                className="w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-[#FCFBF6] text-[#1B2A4A] font-mono border-[#D8D3C4] focus:border-[#2A4B8D] focus:ring-1 focus:ring-[#2A4B8D]"
                style={{ paddingLeft: "34px" }}
              />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onShowContact2Change(true)}
            className="font-mono text-xs font-semibold px-4 py-3 bg-[#FCFBF6] text-[#6B7280] border border-dashed border-[#D8D3C4] rounded-lg hover:border-[#1B2A4A]"
          >
            {method === "telegram"
              ? t.addPhoneBtn || "+ Add phone number"
              : t.addTelegramBtn || "+ Add Telegram"}
          </button>
        )}
      </div>
    </>
  );
};

export default ContactFields;
