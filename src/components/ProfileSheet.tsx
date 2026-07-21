import React, { useEffect, useState } from "react";
import { Translations } from "../types";
import { X, LogOut, Send, Package } from "lucide-react";
import { supabaseBrowser } from "../supabaseClient";
import type { Session } from "@supabase/supabase-js";

interface ProfileSheetProps {
  t: Translations;
  session: Session;
  onClose: () => void;
  onSignOut: () => void;
}

const providerOf = (session: Session): "telegram" | "google" | null => {
  const meta = session.user.user_metadata || {};
  if (meta.telegram_id || meta.telegram_username) return "telegram";
  const provider = session.user.app_metadata?.provider;
  if (provider === "google") return "google";
  return null;
};

const displayNameOf = (session: Session): string => {
  const meta = session.user.user_metadata || {};
  return (
    meta.display_name ||
    meta.full_name ||
    meta.name ||
    (meta.telegram_username ? `@${meta.telegram_username}` : null) ||
    session.user.email ||
    "—"
  );
};

export const ProfileSheet: React.FC<ProfileSheetProps> = ({ t, session, onClose, onSignOut }) => {
  const [postCount, setPostCount] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    supabaseBrowser
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .then(({ count }) => setPostCount(count ?? 0));
  }, [session.user.id]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabaseBrowser.auth.signOut();
    onSignOut();
  };

  const provider = providerOf(session);
  const name = displayNameOf(session);
  const avatarUrl = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
  const methodLabel = provider === "telegram" ? t.methodTelegram : provider === "google" ? t.methodGoogle : "—";
  const initial = name.replace(/^@/, "").charAt(0).toUpperCase() || "?";

  return (
    <div
      className="fixed inset-0 bg-[#1b2a4a]/45 backdrop-blur-[3px] flex items-end justify-center z-[100] animate-[fadein_0.2s_ease]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#FCFBF6] w-full max-w-[560px] rounded-t-2xl px-6 pt-4 pb-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative">
        <div className="w-10 h-1 bg-[#D8D3C4] rounded-full mx-auto mb-5"></div>

        <button
          onClick={onClose}
          className="absolute right-[18px] top-[18px] bg-[#F2EFE6] border-none w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-[#1B2A4A] hover:bg-[#E4E0D2] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-2xl font-extrabold text-[#1B2A4A] tracking-tight mb-5">{t.profileTitle}</h2>

        {/* Identity */}
        <div className="flex items-center gap-4 mb-6">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover border border-[#E4E0D2]" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#1B2A4A] text-[#FCFBF6] flex items-center justify-center text-xl font-black">
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#1B2A4A] truncate">{name}</p>
            <p className="text-sm text-[#5A6272] flex items-center gap-1.5">
              {provider === "telegram" ? <Send className="w-3.5 h-3.5" /> : null}
              {t.profileLoginMethod}: {methodLabel}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 rounded-xl border border-[#E9E5D8] bg-[#F7F4EC] px-4 py-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[#1B2A4A] text-[#C79A3E] flex items-center justify-center">
            <Package className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xl font-black text-[#1B2A4A] leading-none">{postCount ?? "…"}</p>
            <p className="text-xs text-[#5A6272] mt-1">{t.profilePostsCount}</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 border border-[#D8D3C4] rounded-lg py-3 text-sm font-bold text-[#C23B3B] bg-[#FCFBF6] hover:bg-[#F7ECEC] hover:border-[#C23B3B]/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <LogOut className="w-4 h-4" />
          {t.signOut}
        </button>
      </div>
    </div>
  );
};
