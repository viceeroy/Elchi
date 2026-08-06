import React, { useEffect, useState } from "react";
import { Translations } from "../types";
import { X, LogOut, Send, Package } from "lucide-react";
import { supabaseBrowser } from "../supabaseClient";
import type { Session } from "@supabase/auth-js";
import { useDialog } from "../hooks/useDialog";
import { authorNameOf } from "../lib/authorName";

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

export const ProfileSheet: React.FC<ProfileSheetProps> = ({ t, session, onClose, onSignOut }) => {
  const [postCount, setPostCount] = useState<number | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const panelRef = useDialog<HTMLDivElement>(onClose);

  useEffect(() => {
    supabaseBrowser
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .then(({ count }) => setPostCount(count ?? 0));
  }, [session.user.id]);

  // Own row only, under the profiles SELECT policy. This is the ONLY source of
  // the name on this sheet. It used to fall back to session.user_metadata —
  // Google's full_name, Telegram's first_name — which meant the sheet showed a
  // provider's name the user had never chosen, and a different one from the
  // name printed on their own cards. There is no fallback now: `display_name`
  // is what the user typed into the capture gate or nothing at all.
  useEffect(() => {
    supabaseBrowser
      .from("profiles")
      .select("display_name")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) =>
        setProfileName((data as { display_name: string | null } | null)?.display_name ?? null),
      );
  }, [session.user.id]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabaseBrowser.auth.signOut();
    onSignOut();
  };

  const provider = providerOf(session);
  // Null only in the window before the lookup lands, or if it failed — the gate
  // blocks the app until the name exists, so a signed-in user always has one.
  // The same fallback the feed cards use, so the two never disagree.
  const name = authorNameOf(profileName);
  const avatarUrl = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
  const methodLabel = provider === "telegram" ? t.methodTelegram : provider === "google" ? t.methodGoogle : "—";
  const initial = name.replace(/^@/, "").charAt(0).toUpperCase() || "?";

  return (
    <div
      className="fixed inset-0 bg-ink/45 backdrop-blur-[3px] flex items-end justify-center z-[100] animate-[fadein_0.2s_ease]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-sheet-title"
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

        <h2 id="profile-sheet-title" className="text-2xl font-extrabold text-ink tracking-tight mb-5">{t.profileTitle}</h2>

        {/* Identity */}
        <div className="flex items-center gap-4 mb-6">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover border border-rule" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-ink text-card flex items-center justify-center text-xl font-black">
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-lg font-bold text-ink truncate">{name}</p>
            <p className="text-sm text-body flex items-center gap-1.5">
              {provider === "telegram" ? <Send className="w-3.5 h-3.5" /> : null}
              {t.profileLoginMethod}: {methodLabel}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 rounded-xl border border-edge bg-[#F7F4EC] px-4 py-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-ink text-gold flex items-center justify-center">
            <Package className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xl font-black text-ink leading-none">{postCount ?? "…"}</p>
            <p className="text-xs text-body mt-1">{t.profilePostsCount}</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 border border-field rounded-lg py-3 text-sm font-bold text-red bg-card hover:bg-[#F7ECEC] hover:border-red/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <LogOut className="w-4 h-4" />
          {t.signOut}
        </button>
      </div>
    </div>
  );
};
