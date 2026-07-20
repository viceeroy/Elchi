import React, { useEffect, useRef, useState } from "react";
import { Locale, Translations } from "../types";
import { X, Send, Loader2 } from "lucide-react";
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
  const [loading, setLoading] = useState<"telegram" | "google" | null>(null);
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

  const handleGoogleLogin = async () => {
    setLoading("google");
    setError(null);
    const { error: oauthError } = await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) {
      setError(oauthError.message || t.loginErrorGeneral || "Error");
      setLoading(null);
    }
    // On success the page redirects away — no further UI needed here.
  };

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

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 border border-[#D8D3C4] rounded-lg py-3 text-sm font-bold text-[#1B2A4A] bg-[#FCFBF6] hover:border-[#1B2A4A] transition-all disabled:opacity-60"
        >
          {loading === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
          {t.continueWithGoogle}
        </button>

        {error && <p className="text-[#C23B3B] text-sm mt-4">{error}</p>}
      </div>
    </div>
  );
};

const GoogleIcon: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.6 5.6 0 0 1-2.4 3.65v3h3.86c2.26-2.09 3.56-5.17 3.56-8.89z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.86-3c-1.08.72-2.45 1.14-4.07 1.14-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.86 8.87 4.75 12 4.75z" />
  </svg>
);
