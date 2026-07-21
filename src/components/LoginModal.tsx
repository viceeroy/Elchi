import React, { useEffect, useRef, useState } from "react";
import { Locale, Translations } from "../types";
import { X, Send } from "lucide-react";
import { supabaseBrowser } from "../supabaseClient";

interface LoginModalProps {
  t: Translations;
  locale: Locale;
  onClose: () => void;
  onLoginSuccess: () => void;
}

interface TelegramAuthUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthUser) => void;
  }
}

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "";

export const LoginModal: React.FC<LoginModalProps> = ({ t, onClose, onLoginSuccess }) => {
  const [loading, setLoading] = useState<"telegram" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const telegramContainerRef = useRef<HTMLDivElement>(null);

  // Inject the Telegram Login Widget script once on mount
  useEffect(() => {
    if (!TELEGRAM_BOT_USERNAME || !telegramContainerRef.current) return;

    window.onTelegramAuth = async (user: TelegramAuthUser) => {
      setLoading("telegram");
      setError(null);
      try {
        const res = await fetch("/api/auth-telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        const data = await res.json();
        if (!res.ok || !data.hashed_token) {
          throw new Error(data.error || t.loginErrorGeneral);
        }
        const { error: verifyError } = await supabaseBrowser.auth.verifyOtp({
          token_hash: data.hashed_token,
          type: "magiclink",
        });
        if (verifyError) throw verifyError;
        onLoginSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : t.loginErrorGeneral || "Error");
      } finally {
        setLoading(null);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-radius", "8");
    telegramContainerRef.current.innerHTML = "";
    telegramContainerRef.current.appendChild(script);

    return () => {
      window.onTelegramAuth = undefined;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-[#1b2a4a]/45 backdrop-blur-[3px] flex items-end justify-center z-[100] animate-[fadein_0.2s_ease]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#FCFBF6] w-full max-w-[560px] rounded-t-2xl px-6 pt-4 pb-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative">
        {/* Notch pull-bar */}
        <div className="w-10 h-1 bg-[#D8D3C4] rounded-full mx-auto mb-5"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-[18px] top-[18px] bg-[#F2EFE6] border-none w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-[#1B2A4A] hover:bg-[#E4E0D2] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-2xl font-extrabold text-[#1B2A4A] tracking-tight mb-1">{t.loginTitle}</h2>
        <p className="text-sm text-[#5A6272] mb-6">{t.loginSubtitle}</p>

        {/* Telegram widget mounts here */}
        <div className="mb-3 flex justify-center min-h-[40px]" ref={telegramContainerRef}>
          {!TELEGRAM_BOT_USERNAME && (
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 border border-[#D8D3C4] rounded-lg py-3 text-sm font-bold text-[#8A8F98] cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {t.continueWithTelegram}
            </button>
          )}
        </div>

        {loading === "telegram" && <p className="text-[#5A6272] text-sm mt-2">...</p>}
        {error && <p className="text-[#C23B3B] text-sm mt-4">{error}</p>}
      </div>
    </div>
  );
};
