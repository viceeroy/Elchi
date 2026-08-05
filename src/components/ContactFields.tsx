import React from "react";
import { Phone, Send, AlertCircle, X } from "lucide-react";
import { ContactMethod, Translations } from "../types";

// Phone fields keep digits and the punctuation used by the +998/+82 formats
// in the placeholder; letters and everything else are dropped as the user types.
export const sanitizePhone = (value: string) => value.replace(/[^\d+\-\s()]/g, "");

const ERROR_INPUT_CLASS =
  "border-red focus:border-red ring-1 ring-red/30";

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
  // Overrides the section label. A node rather than a string because the two
  // callers disagree about more than the words: the note sheet says the field
  // is optional in plain text, the parcel form appends a red required asterisk.
  label?: React.ReactNode;
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
 * Used by both composers. It had a second life as ~180 duplicated lines inside
 * PostFormModal, which is how the two sheets came to disagree about the size of
 * the channel toggle; anything that touches how a handle is entered or
 * normalised belongs here, once, so a fix cannot land on one sheet only.
 *
 * What deliberately does NOT live here is what happens when the author switches
 * channels with text already typed. The parcel form promotes a bare "someone"
 * to "@someone" and seeds an empty field with "@"; the note sheet must not,
 * because its contact is optional and a lone "@" would turn an empty field into
 * a validation error. So the toggle reports the change through onMethodChange
 * and each caller decides. Only the Telegram → phone direction is handled here,
 * because stripping a "@" that can no longer be valid is the same answer for
 * both.
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
          <label className="block font-mono text-[10.5px] tracking-wider uppercase text-blue font-bold">
            {label || t.contactLabel}
          </label>

          {/* scale-[0.9] origin-right: the toggle is a secondary control and
              reads as one at 90%, which is the size the parcel composer always
              used. It carried the classes locally while it had its own copy of
              this markup, so adopting the shared component silently grew it —
              the scale lives here now, and both sheets get it. origin-right
              keeps the right edge pinned to the label row's justify-between, so
              the shrink comes off the left and nothing shifts. */}
          <div className="flex bg-paper border border-edge rounded-lg p-0.5 gap-0.5 scale-[0.9] origin-right">
            <button
              type="button"
              onClick={() => onMethodChange("telegram")}
              className={`px-3 py-1 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                method === "telegram"
                  ? "bg-blue text-white shadow-sm"
                  : "text-body hover:text-ink"
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
            {method === "telegram" ? (
              <span className="font-mono text-sm font-bold text-blue mr-0.5">@</span>
            ) : (
              <Phone className="w-4 h-4 text-green" />
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
            className={`w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-card text-ink font-mono transition-all ${
              error
                ? ERROR_INPUT_CLASS
                : method === "telegram"
                  ? "border-field focus:border-blue focus:ring-1 focus:ring-blue"
                  : "border-field focus:border-green focus:ring-1 focus:ring-green"
            }`}
            style={{ paddingLeft: "34px" }}
          />
        </div>

        {error && (
          <p className="mt-1.5 flex items-center gap-1.5 text-red text-[12px] font-semibold">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </p>
        )}

        {/* Live preview of the t.me link, or country-code shortcuts for phones */}
        {method === "telegram" ? (
          handle && (
            <div className="mt-1.5 font-mono text-[10.5px] text-blue flex items-center gap-1.5 bg-[#E8EEF8]/60 px-2.5 py-1.5 rounded-md border border-[#D5E2F4] w-fit">
              <Send className="w-3 h-3" />
              {/* /90 rather than /75, which composited to 4.13:1 on the chip's
                  tinted background — under AA at 10.5px. */}
              <span className="opacity-90">Telegram havola:</span>
              <a
                href={`https://t.me/${handle}`}
                target="_blank"
                rel="noreferrer"
                className="underline text-gold-deep font-bold hover:text-ink tracking-tight"
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
              className="font-mono text-[10px] px-2 py-0.5 bg-emerald-50 text-green border border-emerald-100 rounded hover:bg-emerald-100 transition-all"
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
              className="font-mono text-[10px] px-2 py-0.5 bg-emerald-50 text-green border border-emerald-100 rounded hover:bg-emerald-100 transition-all"
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
              <label className="block font-mono text-[10.5px] tracking-wider uppercase text-blue font-bold">
                {t.secondaryContactLabel || "Qo'shimcha bog'lanish"}
              </label>
              <button
                type="button"
                onClick={() => {
                  onShowContact2Change(false);
                  onContact2Change("");
                }}
                className="text-faint hover:text-red"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-faint">
                {method === "telegram" ? (
                  <Phone className="w-4 h-4 text-green" />
                ) : (
                  <span className="font-mono text-sm font-bold text-blue mr-0.5">@</span>
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
                className="w-full box-sizing-border-box p-3 border rounded-lg text-sm bg-card text-ink font-mono border-field focus:border-blue focus:ring-1 focus:ring-blue"
                style={{ paddingLeft: "34px" }}
              />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onShowContact2Change(true)}
            className="font-mono text-xs font-semibold px-4 py-3 bg-card text-body border border-dashed border-field rounded-lg hover:border-ink"
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
