import React, { useEffect, useRef, useState } from "react";
import { Translations } from "../types";
import { X } from "lucide-react";
import { supabaseBrowser } from "../supabaseClient";

interface LoginModalProps {
  t: Translations;
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
  // Telegram renders a fixed-width iframe button we can't restyle. Measure it
  // once it mounts and match the Google button + divider to the same width so
  // the two options read as a set.
  const [tgWidth, setTgWidth] = useState<number | null>(null);
  // The Telegram widget script loads from telegram.org and renders its iframe
  // async, leaving a blank gap on slow connections. Track when the iframe
  // actually paints so we can show a skeleton placeholder until then.
  const [tgReady, setTgReady] = useState(false);

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

    // Once Telegram injects its iframe, read its width so the Google button and
    // divider below can match it. Watch for the iframe appearing/resizing.
    const observer = new MutationObserver(() => {
      const iframe = telegramContainerRef.current?.querySelector("iframe");
      if (iframe && iframe.offsetWidth > 0) {
        setTgWidth(iframe.offsetWidth);
        setTgReady(true);
      }
    });
    observer.observe(telegramContainerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      observer.disconnect();
      window.onTelegramAuth = undefined;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-ink/45 backdrop-blur-[3px] flex items-end justify-center z-[100] animate-[fadein_0.2s_ease]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card w-full max-w-[560px] rounded-t-2xl px-6 pt-4 pb-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative">
        {/* Notch pull-bar */}
        <div className="w-10 h-1 bg-field rounded-full mx-auto mb-5"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-[18px] top-[18px] bg-paper border-none w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-ink hover:bg-rule transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-2xl font-extrabold text-ink tracking-tight mb-1">{t.loginTitle}</h2>
        <p className="text-sm text-body mb-6">{t.loginSubtitle}</p>

        {/* Auth options in a centered column sized to the Telegram widget, so
            the fixed-width Telegram button and the Google button below share the
            same footprint and read as a set. Falls back to 280px until measured. */}
        <div
          className="mx-auto flex flex-col items-stretch"
          style={{ width: tgWidth ? `${tgWidth}px` : "280px" }}
        >
          {/* Native Telegram login widget. Telegram renders its own iframe button
              whose click target must not be overlaid or resized, or the button
              silently stops responding — so it's shown as-is, centered. */}
          <div className="relative flex justify-center min-h-[40px]">
            {TELEGRAM_BOT_USERNAME && !tgReady && (
              <div className="absolute inset-0 h-10 rounded-lg bg-rule animate-pulse" />
            )}
            <div className="flex justify-center w-full" ref={telegramContainerRef} />
          </div>
          {!TELEGRAM_BOT_USERNAME && (
            <p className="text-red text-xs text-center">
              {t.loginErrorGeneral || "Telegram login unavailable"}
            </p>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <span className="flex-1 h-px bg-rule" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-faint">
              {t.orDivider || "yoki"}
            </span>
            <span className="flex-1 h-px bg-rule" />
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 border border-field rounded-lg py-3 text-sm font-bold text-ink bg-card hover:bg-paper transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            {t.continueWithGoogle}
          </button>

          {(loading === "telegram" || loading === "google") && <p className="text-body text-sm mt-2 text-center">...</p>}
          {error && <p className="text-red text-sm mt-4 text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
};
