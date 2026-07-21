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
  const [loading, setLoading] = useState<"telegram" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading("google");
    setError(null);
    try {
      // Supabase redirects to Google, then back to the app; detectSessionInUrl
      // (supabaseClient) picks up the session and onAuthStateChange fires.
      const { error: oauthError } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loginErrorGeneral || "Error");
      setLoading(null);
    }
  };

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

        {/* Google OAuth */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 border border-[#D8D3C4] rounded-lg py-3 text-sm font-bold text-[#1B2A4A] bg-[#FCFBF6] hover:bg-[#F2EFE6] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          {t.continueWithGoogle}
        </button>

        {(loading === "telegram" || loading === "google") && <p className="text-[#5A6272] text-sm mt-2">...</p>}
        {error && <p className="text-[#C23B3B] text-sm mt-4">{error}</p>}
      </div>
    </div>
  );
};
