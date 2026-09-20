import React, { useState, useEffect, useRef } from "react";
import { Translations } from "../types";
import { X, Send } from "lucide-react";
import { supabaseBrowser } from "../supabaseClient";
import { useDialog } from "../hooks/useDialog";

interface LoginModalProps {
  t: Translations;
  onClose: () => void;
  onLoginSuccess: () => void;
}

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "";

export const LoginModal: React.FC<LoginModalProps> = ({ t, onClose, onLoginSuccess }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "polling" | "verified" | "expired">("idle");
  const panelRef = useDialog<HTMLDivElement>(onClose);
  const pollIntervalRef = useRef<number | null>(null);

  const startLoginFlow = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signup-start", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || t.loginErrorGeneral || "Error");
      }
      setToken(data.token);
      setStatus("polling");
      window.open(`https://t.me/${TELEGRAM_BOT_USERNAME}?start=login_${data.token}`, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loginErrorGeneral || "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "polling" || !token) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/signup-status?token=${token}`);
        const data = await res.json();
        
        if (data.status === "verified" && data.hashed_token) {
          setStatus("verified");
          if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
          
          const { error: verifyError } = await supabaseBrowser.auth.verifyOtp({
            token_hash: data.hashed_token,
            type: "magiclink",
          });
          
          if (verifyError) throw verifyError;
          onLoginSuccess();
        } else if (data.status === "expired") {
          setStatus("expired");
          setError(t.loginSessionExpired || "Sessiya muddati o'tgan. Iltimos qaytadan kiring.");
          if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
        }
      } catch (err) {
        // Log quietly, let it retry on next interval unless it's a hard fail
        console.error("Status check failed", err);
      }
    };

    pollIntervalRef.current = window.setInterval(checkStatus, 2000);

    return () => {
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
      }
    };
  }, [status, token, onLoginSuccess, t]);

  return (
    <div
      className="fixed inset-0 bg-ink/45 backdrop-blur-[3px] flex items-end justify-center z-[100] animate-[fadein_0.2s_ease]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        tabIndex={-1}
        className="bg-card w-full max-w-[560px] rounded-t-2xl px-6 pt-4 pb-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative outline-none"
      >
        <div className="w-10 h-1 bg-field rounded-full mx-auto mb-5" aria-hidden="true"></div>

        <button
          onClick={onClose}
          aria-label={t.closeLabel || "Yopish"}
          className="absolute right-[18px] top-[18px] bg-paper border-none w-8 h-8 rounded-full flex items-center justify-center text-body hover:text-ink hover:bg-rule transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <h2 id="login-modal-title" className="text-2xl font-extrabold text-ink tracking-tight mb-1">{t.loginTitle}</h2>
        <p className="text-sm text-body mb-6">{t.loginSubtitle}</p>

        <div className="mx-auto flex flex-col items-stretch w-[280px]">
          {status === "polling" ? (
             <div className="flex flex-col items-center gap-4 text-center">
               <div className="flex items-center gap-2 text-ink font-semibold">
                  <svg className="animate-spin w-5 h-5 text-ink" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Telegram botida tasdiqlang...</span>
               </div>
               <p className="text-sm text-body">
                 Biz sizni Telegram botga yo'naltirdik. Iltimos, u yerda <b>✅ Tasdiqlash</b> tugmasini bosing.
               </p>
             </div>
          ) : (
            <button
              onClick={startLoginFlow}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 border-none rounded-lg py-3 text-sm font-bold text-ink bg-telegram hover:bg-telegram-deep transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Telegram orqali kirish
            </button>
          )}

          {!TELEGRAM_BOT_USERNAME && (
            <p className="text-red text-xs text-center mt-2">
              {t.loginErrorGeneral || "Telegram login unavailable"}
            </p>
          )}

          {error && <p className="text-red text-sm mt-4 text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
};
