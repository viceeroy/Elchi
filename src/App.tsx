import React, { useState, useEffect } from "react";
import { Post, PostContact, Locale, PostType, ContactMethod } from "./types";
import { telegramUsername, phoneDialString } from "../lib/contact";
import { translations, defaultLocale } from "./translations";
import { COUNTRIES, getCountry } from "./constants";
import { BoardingPass } from "./components/BoardingPass";
import { RouteSelector } from "./components/RouteSelector";
import { PostFormModal } from "./components/PostFormModal";
import { LoginModal } from "./components/LoginModal";
import { ProfileSheet } from "./components/ProfileSheet";
import { supabaseBrowser } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { Send, Globe, ShieldAlert, Sparkles, MessageSquare, Briefcase, Package, X, Phone, Share2, Check, Copy, User, Trash2, Lock } from "lucide-react";
import elchiLogo from "./assets/logo/elchi-logo-icon.svg";

const LOCALE_LABELS: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
  en: "English",
};

// Traveler posts store the luggage count as a neutral "chamadon" token
// regardless of the author's locale (see PostFormModal). Re-localize it here
// from the count so it matches the viewer's current locale rather than
// freezing to whichever language the post was created in.
// The feed is paged server-side, so a bounded response can't be turned into a
// full dump of the board.
const PAGE_SIZE = 24;

function localizeWeight(weight: string, locale: Locale): string {
  return weight.replace(/(\d+)\s*chamadon\b/gi, (_match, numStr: string) => {
    const n = parseInt(numStr, 10);
    const word = n === 1
      ? (locale === "uz" ? "chamadon" : locale === "ru" ? "чемодан" : "bag")
      : (locale === "uz" ? "ta chamadon" : locale === "ru" ? "чемодана" : "bags");
    return `${n} ${word}`;
  });
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem("elchi_locale");
    return (saved as Locale) || defaultLocale;
  });

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  // Route filter — an exact ISO country pair chosen in the RouteSelector card.
  // Defaults to the main corridor, Korea → Uzbekistan.
  const [route, setRoute] = useState<{ from: string; to: string }>({ from: "KR", to: "UZ" });
  const [formOpen, setFormOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [contactCopied, setContactCopied] = useState(false);
  const [createdToastOpen, setCreatedToastOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalPosts, setTotalPosts] = useState(0);
  // Contact handles for the open post. Never part of the feed payload — fetched
  // on demand, and only for logged-in viewers.
  const [revealedContact, setRevealedContact] = useState<PostContact | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = React.useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const pendingAddPostRef = React.useRef(false);

  // Track auth session so add-post can be gated behind Telegram login
  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabaseBrowser.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      // Strip leftover OAuth hash (#access_token / bare #) from URL bar
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleAddPostClick = () => {
    if (session) {
      setFormOpen(true);
    } else {
      pendingAddPostRef.current = true;
      setLoginOpen(true);
    }
  };

  // Close language dropdown on outside click
  useEffect(() => {
    if (!langMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [langMenuOpen]);

  // Active translation dictionary
  const t = translations[locale];

  // Keep the document title, meta description and <html lang> in sync with the
  // chosen locale — the static index.html ships Uzbek, so RU/EN users would
  // otherwise see Uzbek metadata in the tab and in search/social previews.
  useEffect(() => {
    document.title = t.metaTitle;
    document.documentElement.lang = locale;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", t.metaDescription);
  }, [locale, t.metaTitle, t.metaDescription]);

  // Handle URL deep linking. Resolved against the API directly rather than the
  // loaded feed: with server-side paging a shared post may sit past the first
  // page, or on a different route than the one currently selected.
  const deepLinkHandled = React.useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const postIdParam = params.get("postId") || params.get("post");
    if (!postIdParam) return;
    deepLinkHandled.current = true;

    (async () => {
      try {
        // Read the session directly rather than from state: this runs on mount,
        // before onAuthStateChange has necessarily fired. Without it the author
        // of a deep-linked post wouldn't see their own delete button.
        const { data: { session: current } } = await supabaseBrowser.auth.getSession();
        const res = await fetch(`/api/posts?id=${encodeURIComponent(postIdParam)}`, {
          headers: current ? { Authorization: `Bearer ${current.access_token}` } : {},
        });
        if (res.ok) setSelectedPost(await res.json());
      } catch (err) {
        console.error("Error resolving shared post:", err);
      }
    })();
  }, []);

  // Lock background scroll while any modal (detail sheet or post form) is open.
  // Uses position:fixed on <body> so touch/swipe gestures can't scroll the list
  // behind the overlay (the cause of the "shaking" background), and restores the
  // exact prior scroll position on close so the user doesn't jump.
  useEffect(() => {
    const isModalOpen = selectedPost !== null || formOpen;
    if (!isModalOpen) return;

    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const body = document.body;

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.paddingRight = "";
      window.scrollTo(0, scrollY);
    };
  }, [selectedPost, formOpen]);

  const closeDetailModal = () => {
    setSelectedPost(null);
    setShareCopied(false);
    setContactCopied(false);
    setRevealedContact(null);
    setContactError(null);
    // Clean up query param if present to keep URL neat
    const params = new URLSearchParams(window.location.search);
    if (params.has("postId") || params.has("post")) {
      params.delete("postId");
      params.delete("post");
      const newQuery = params.toString();
      const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  };

  const handleShare = async () => {
    if (!selectedPost) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}?postId=${selectedPost.id}`;
    const shareWeight = localizeWeight(selectedPost.weight, locale);
    // The contact handle is deliberately left out of the share text: it would
    // republish someone's phone number into whatever app the link is sent to.
    // The recipient opens the post and reveals it themselves.
    const shareText = selectedPost.type === "traveler"
      ? `Elchi: ${selectedPost.from_city} → ${selectedPost.to_city} (${shareWeight}) uchyapman.`
      : `Elchi: ${selectedPost.from_city} → ${selectedPost.to_city} (${shareWeight}) pochta yuborish kerak.`;

    const shareTitle = t.shareTitle || "Elchi e'lon taxtasi";

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        console.log("Web Share failed or cancelled, falling back to copy:", err);
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
      // Fallback text copy using temporary input
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const handleCopyContact = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setContactCopied(true);
      setTimeout(() => setContactCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy contact:", err);
      const input = document.createElement("input");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setContactCopied(true);
      setTimeout(() => setContactCopied(false), 2000);
    }
  };

  // Fetch a page of posts. The route filter and the page bounds are applied in
  // SQL, so the client never holds — and the API never emits — the whole board.
  // The bearer token is sent when present purely so the API can flag which
  // posts are the viewer's own (is_mine); it is not required to read the feed.
  const fetchPosts = async (opts?: { append?: boolean }) => {
    const append = opts?.append ?? false;
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({
        from: route.from,
        to: route.to,
        limit: String(PAGE_SIZE),
        offset: String(append ? posts.length : 0),
      });
      const { data: { session: current } } = await supabaseBrowser.auth.getSession();
      const res = await fetch(`/api/posts?${params.toString()}`, {
        headers: current ? { Authorization: `Bearer ${current.access_token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const page: Post[] = Array.isArray(data.posts) ? data.posts : [];
        setPosts((prev) => (append ? [...prev, ...page] : page));
        setHasMore(Boolean(data.hasMore));
        setTotalPosts(typeof data.total === "number" ? data.total : page.length);
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  // Refetch from page 1 whenever the route changes, and when the session
  // changes so is_mine is recomputed for the new viewer.
  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.from, route.to, session?.user?.id]);

  // Pull the open post's contact handles. Logged-out viewers get nothing to
  // fetch — the reveal is gated server-side too, so this is UI only.
  useEffect(() => {
    setRevealedContact(null);
    setContactError(null);
    if (!selectedPost || !session) return;

    let cancelled = false;
    setContactLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/posts?id=${encodeURIComponent(selectedPost.id)}&fields=contact`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) setRevealedContact(data as PostContact);
        else setContactError(data.error || t.errorGeneral);
      } catch (err) {
        console.error("Error fetching contact:", err);
        if (!cancelled) setContactError(t.errorGeneral);
      } finally {
        if (!cancelled) setContactLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPost?.id, session?.user?.id]);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("elchi_locale", newLocale);
  };

  const handlePostSubmitSuccess = () => {
    setFormOpen(false);
    fetchPosts(); // Refresh feed with the new post
    setCreatedToastOpen(true);
    setTimeout(() => {
      setCreatedToastOpen(false);
    }, 4000);
  };

  const [deleting, setDeleting] = useState(false);

  const handleDeletePost = async () => {
    if (!selectedPost || !session) return;
    if (!window.confirm(t.deleteConfirm)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts?id=${encodeURIComponent(selectedPost.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        closeDetailModal();
        fetchPosts();
      } else {
        console.error("Failed to delete post", await res.text());
      }
    } catch (err) {
      console.error("Error deleting post:", err);
    } finally {
      setDeleting(false);
    }
  };

  // Build the Telegram or phone link for a contact.
  //
  // The channel comes from the stored contact_type, not from sniffing a leading
  // "@" — the type is what the author actually chose and what the API now
  // validates the handle against. The "@" heuristic only agreed with it by
  // convention, and disagreed for any row where the two drifted. Rows written
  // before contact_type existed were backfilled, but fall back to the old
  // heuristic if it is somehow null.
  const getContactLinkAndLabel = (contactStr: string, kind: ContactMethod | null) => {
    const trimmed = contactStr.trim();
    const isTelegram = kind ? kind === "telegram" : trimmed.startsWith("@");

    return {
      // Both sides are sanitised rather than interpolated raw: a legacy row
      // that predates validation can't steer the URL anywhere unintended.
      url: isTelegram
        ? `https://t.me/${telegramUsername(trimmed)}`
        : `tel:${phoneDialString(trimmed)}`,
      label: trimmed,
      isTelegram,
    };
  };

  // Human-friendly date inside detail modal
  const formatDetailDate = (dateStr: string) => {
    if (dateStr === "flexible") {
      return locale === "uz" ? "Kelishiladi" : locale === "ru" ? "По договорённости" : "Flexible";
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      
      const monthNamesUz = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
      const monthNamesRu = ['Января','Февраля','Марта','Апреля','Мая','Июня','Июля','Августа','Сентября','Октября','Ноября','Декабря'];
      const monthNamesEn = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      
      const day = d.getDate();
      let month = "";
      if (locale === "uz") month = monthNamesUz[d.getMonth()];
      else if (locale === "ru") month = monthNamesRu[d.getMonth()];
      else month = monthNamesEn[d.getMonth()];

      return `${day}-${month}, ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  // Route headline = localized country names from the stored ISO codes
  const getHubRoute = (post: Post) => {
    const from = getCountry(post.from_country) ?? COUNTRIES[0];
    const to = getCountry(post.to_country) ?? COUNTRIES.find((c) => c.code !== from.code)!;
    return { hubFrom: from.names[locale], hubTo: to.names[locale] };
  };

  return (
    <div className="min-h-screen pb-[120px] bg-[#F2EFE6] text-[#1B2A4A] relative">
      {/* Airmail stripes at the very top */}
      <div className="h-2 bg-[repeating-linear-gradient(-45deg,#C23B3B_0_12px,#FCFBF6_12px_17px,#2A4B8D_17px_29px,#FCFBF6_29px_34px)]"></div>

      {/* Header / Navbar */}
      <header className="bg-[#FCFBF6]/90 backdrop-blur-md border-b border-[#E4E0D2] sticky top-0 z-40 shadow-sm">
        <div className="max-w-[680px] mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={elchiLogo} alt="" className="h-7 w-auto" />
            <span className="font-extrabold text-[19px] tracking-tight text-[#1B2A4A]">Elchi</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setLangMenuOpen((v) => !v)}
                aria-label="Change language"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E4E0D2] bg-[#F2EFE6] text-[#1B2A4A] hover:border-[#1B2A4A] transition-all"
              >
                <Globe size={16} />
              </button>
              {langMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] bg-[#FCFBF6] border border-[#E4E0D2] rounded-lg shadow-lg py-1 min-w-[140px] z-50">
                  {(["uz", "ru", "en"] as Locale[]).map((loc) => (
                    <button
                      key={loc}
                      onClick={() => {
                        changeLocale(loc);
                        setLangMenuOpen(false);
                      }}
                      className={`w-full text-left text-[13px] px-3 py-1.5 transition-all ${
                        locale === loc
                          ? "font-bold text-[#1B2A4A] bg-[#F2EFE6]"
                          : "text-[#5A6272] hover:bg-[#F2EFE6]"
                      }`}
                    >
                      {LOCALE_LABELS[loc]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (session) {
                  setProfileOpen(true);
                } else {
                  pendingAddPostRef.current = false;
                  setLoginOpen(true);
                }
              }}
              aria-label={t.profileMenuLabel || "Profile"}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E4E0D2] bg-[#F2EFE6] text-[#1B2A4A] hover:border-[#1B2A4A] transition-all"
            >
              <User size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Board Container */}
      <main className="max-w-[680px] mx-auto px-5">
        
        {/* Hero Section */}
        <section className="pt-6 pb-2">
          <h1 className="text-3xl sm:text-4xl leading-[1.05] font-black m-0 mb-2 tracking-tight">
            <span className="text-[#C23B3B]">{t.title}</span>
            <span className="block sm:inline">{t.titleAccent}</span>
          </h1>
        </section>

        {/* Posts Filter and Feed */}
        <section className="pt-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-extrabold tracking-tight text-[#1B2A4A]">{t.activeAds}</h2>
            <span className="font-mono text-[11px] text-[#8A8F98] tracking-wider">
              {totalPosts} {t.activeCount}
            </span>
          </div>

          {/* Route selector card — picking any pair of countries filters the feed */}
          <div className="mb-6">
            <RouteSelector
              locale={locale}
              fromCode={route.from}
              toCode={route.to}
              onChange={(from, to) => setRoute({ from, to })}
            />
          </div>

          {/* Posts Feed */}
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_88px] sm:grid-cols-[1fr_110px] md:grid-cols-[1fr_135px] bg-[#FCFBF6] rounded-xl border border-[#E9E5D8] overflow-hidden animate-pulse"
                  style={{ boxShadow: "0 1px 2px rgba(27,42,74,0.04), 0 10px 28px -18px rgba(27,42,74,0.18)" }}
                >
                  <div className="pt-8 pb-5 pl-5 pr-3 sm:pl-8 sm:pr-6 md:py-6 md:pl-10 md:pr-7 flex flex-col gap-3">
                    <div className="h-5 w-2/3 bg-[#E9E5D8] rounded" />
                    <div className="h-3.5 w-1/3 bg-[#E9E5D8] rounded" />
                    <div className="h-3.5 w-4/5 bg-[#E9E5D8] rounded mt-2" />
                  </div>
                  <div className="bg-[#EDEAE0] flex flex-col items-center justify-center gap-2 p-3">
                    <div className="h-3 w-10 bg-[#DDD8C9] rounded" />
                    <div className="h-4 w-14 bg-[#DDD8C9] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length > 0 ? (
            <div className="flex flex-col gap-4">
              {posts.map((post) => (
                <BoardingPass
                  key={post.id}
                  post={post}
                  t={t}
                  locale={locale}
                  onOpen={() => setSelectedPost(post)}
                />
              ))}

              {hasMore ? (
                <div className="mt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => fetchPosts({ append: true })}
                    disabled={loadingMore}
                    className="font-mono text-xs font-bold py-3 px-6 bg-[#FCFBF6] border border-[#D8D3C4] hover:border-[#2A4B8D] hover:text-[#2A4B8D] rounded-xl text-[#1B2A4A] flex items-center gap-2 transition-all shadow-sm active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span>{loadingMore ? (t.submittingBtn || "...") : (t.loadMoreBtn || "Yana yuklash ↓")}</span>
                  </button>
                </div>
              ) : posts.length > PAGE_SIZE ? (
                <div className="mt-4 text-center text-xs font-mono text-[#8A8F98] tracking-wider py-2">
                  ✓ {t.allLoaded || "Barcha e'lonlar yuklandi"}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-center py-16 bg-[#FCFBF6] rounded-xl border border-[#E9E5D8] px-6">
              <Package className="w-12 h-12 text-[#8A8F98] mx-auto mb-3" />
              <p className="text-[15px] font-bold text-[#1B2A4A] m-0 mb-1">{t.emptyStateTitle || "E'lonlar topilmadi"}</p>
              <p className="text-sm text-[#8A8F98] m-0">{t.emptyStateText || "Hozircha ushbu yo'nalishda faol e'lonlar mavjud emas."}</p>
            </div>
          )}

          {/* Disclaimer Banner */}
          <div className="mt-6 p-3 bg-[#FCFBF6] border border-[#E9E5D8] border-l-4 border-l-[#C79A3E] rounded-r-xl text-[13px] text-[#6B7280] leading-snug shadow-sm">
            <span className="font-bold text-[#1B2A4A] mr-1">{t.disclaimerTitle}</span>
            {t.disclaimerText}
          </div>
        </section>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center z-30 pointer-events-none">
        <button
          onClick={handleAddPostClick}
          className="pointer-events-auto bg-[#1B2A4A] text-[#FCFBF6] border-none py-3.5 pl-4 pr-6 rounded-full font-bold text-[15px] flex items-center gap-3 cursor-pointer shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all"
        >
          <span className="w-6 h-6 bg-[#C79A3E] text-[#1B2A4A] rounded-full flex items-center justify-center text-lg font-black">+</span>
          {t.postAdBtn}
        </button>
      </div>

      {/* Post Creation Bottom Sheet Modal */}
      {formOpen && (
        <PostFormModal
          t={t}
          locale={locale}
          onClose={() => setFormOpen(false)}
          onSubmitSuccess={handlePostSubmitSuccess}
        />
      )}

      {/* Login Modal — Telegram only, required to add a post */}
      {loginOpen && (
        <LoginModal
          t={t}
          locale={locale}
          onClose={() => setLoginOpen(false)}
          onLoginSuccess={() => {
            setLoginOpen(false);
            if (pendingAddPostRef.current) {
              pendingAddPostRef.current = false;
              setFormOpen(true);
            }
          }}
        />
      )}

      {/* Profile Bottom Sheet — shown when the logged-in user taps the profile icon */}
      {profileOpen && session && (
        <ProfileSheet
          t={t}
          session={session}
          onClose={() => setProfileOpen(false)}
          onSignOut={() => setProfileOpen(false)}
        />
      )}

      {/* Post Detail Viewer Bottom Sheet Modal */}
      {selectedPost && (
        <div 
          className="fixed inset-0 bg-[#1b2a4a]/45 backdrop-blur-[3px] flex items-end justify-center z-[100] animate-[fadein_0.2s_ease]"
          onClick={(e) => e.target === e.currentTarget && closeDetailModal()}
        >
          <div className="bg-[#FCFBF6] w-full max-w-[560px] rounded-t-2xl pb-8 max-h-[88vh] overflow-y-auto shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative">
            
            {/* Header portion inside card format */}
            <div className="bg-[#1B2A4A] text-[#FCFBF6] px-6 pt-4 pb-7 relative rounded-t-2xl">
              <div className="w-10 h-1 bg-white/25 rounded-full mx-auto mb-5"></div>
              <button
                onClick={closeDetailModal}
                className="absolute right-[18px] top-[16px] bg-white/10 hover:bg-white/20 border-none w-8 h-8 rounded-full flex items-center justify-center text-[#FCFBF6] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div 
                className="font-mono text-[10.5px] uppercase px-3 py-1.5 rounded inline-flex items-center gap-1.5"
                style={{
                  background: selectedPost.type === "traveler" ? "#C79A3E" : "#C23B3B",
                  color: "#1B2A4A",
                  fontWeight: 700
                }}
              >
                {selectedPost.type === "traveler" ? (
                  <Briefcase className="w-3.5 h-3.5 text-[#1B2A4A]" />
                ) : (
                  <Package className="w-3.5 h-3.5 text-[#1B2A4A]" />
                )}
                {selectedPost.type === "traveler" ? t.travelerTag : t.requestTag}
              </div>

              {/* Destinations (country route from the stored ISO codes; cities shown as detail) */}
              {(() => {
                const { hubFrom, hubTo } = getHubRoute(selectedPost);
                const showActualCities = selectedPost.from_city !== hubFrom || selectedPost.to_city !== hubTo;
                return (
                  <>
                    <div className="flex items-center gap-3 font-black text-2xl tracking-tight mt-3">
                      <span>{hubFrom}</span>
                      <span className="text-[#C79A3E] flex items-center">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      </span>
                      <span>{hubTo}</span>
                    </div>
                    {showActualCities && (
                      <div className="font-mono text-xs opacity-70 mt-1 tracking-wider">
                        {selectedPost.from_city} → {selectedPost.to_city}
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="font-mono text-xs opacity-70 mt-1.5 tracking-wider">
                {selectedPost.type === "traveler" ? t.dateLabelTraveler : t.dateLabelRequest} · {formatDetailDate(selectedPost.date)}
              </div>
            </div>

            {/* Body of details */}
            <div className="px-6 pt-6">
              <div className="bg-[#F2EFE6] rounded-xl p-3.5 mb-5">
                <div className="font-mono text-[10px] tracking-wider uppercase text-[#2A4B8D] mb-1">{selectedPost.type === "traveler" ? t.weightLabelTraveler : t.weightLabelRequest}</div>
                <div className="font-bold text-base text-[#1B2A4A]">{localizeWeight(selectedPost.weight, locale)}</div>
              </div>

              {selectedPost.note && (
                <div className="mb-5">
                  <div className="font-mono text-[10px] tracking-wider uppercase text-[#2A4B8D] mb-2">{t.noteLabel.replace(" (ixtiyoriy)", "")}</div>
                  <div className="text-[14px] text-[#3A4256] leading-relaxed bg-[#FCFBF6] border border-[#E9E5D8] border-l-4 border-l-[#C79A3E] p-4 rounded-r-lg italic [overflow-wrap:anywhere] whitespace-pre-wrap max-h-[40vh] overflow-y-auto">
                    "{selectedPost.note}"
                  </div>
                </div>
              )}

              {/* Share / Delete — icon-only, right-aligned */}
              <div className="mb-5 flex items-center justify-end gap-2">
                <button
                  onClick={handleShare}
                  title={shareCopied ? (t.shareSuccess || "Havola nusxalandi!") : (t.shareBtn || "Ulashish")}
                  aria-label={shareCopied ? (t.shareSuccess || "Havola nusxalandi!") : (t.shareBtn || "Ulashish")}
                  className="w-10 h-10 flex items-center justify-center bg-[#FCFBF6] border border-[#D8D3C4] hover:border-[#2A4B8D] rounded-xl transition-all shadow-sm active:scale-[0.98]"
                  id="share-post-btn"
                >
                  {shareCopied ? (
                    <Check className="w-4 h-4 text-emerald-600 animate-[bounce_0.2s_ease-in-out]" />
                  ) : (
                    <Share2 className="w-4 h-4 text-[#C79A3E]" />
                  )}
                </button>

                {session?.user?.id && selectedPost.is_mine && (
                  <button
                    onClick={handleDeletePost}
                    disabled={deleting}
                    title={t.deleteBtn}
                    aria-label={t.deleteBtn}
                    className="w-10 h-10 flex items-center justify-center bg-[#FCFBF6] border border-[#D8D3C4] hover:border-[#C23B3B] hover:bg-[#F7ECEC] rounded-xl text-[#C23B3B] transition-all shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    id="delete-post-btn"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Action and Contact segment — single unified section */}
              {(() => {
                const sectionLabel = (
                  <div className="font-mono text-[10px] tracking-wider uppercase text-[#8A8F98]">
                    {t.contactLabel}
                  </div>
                );

                // Logged out: there is nothing to render. Contact handles are
                // not part of the feed payload and the reveal endpoint rejects
                // unauthenticated callers, so this prompt is the only route to
                // them — which is what stops the board being scraped for phone
                // numbers.
                if (!session) {
                  return (
                    <div className="flex flex-col gap-3 p-4 bg-[#F2EFE6] rounded-xl">
                      {sectionLabel}
                      <p className="text-[13px] text-[#6B7280] m-0 leading-snug">
                        {t.contactLockedText}
                      </p>
                      <button
                        type="button"
                        onClick={() => setLoginOpen(true)}
                        className="font-mono text-xs px-4 py-2.5 rounded-lg font-bold text-center flex items-center justify-center gap-2 transition-all w-full bg-[#2A4B8D] hover:bg-[#1B2A4A] text-[#FCFBF6]"
                        id="reveal-contact-btn"
                      >
                        <Lock className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{t.contactLockedBtn}</span>
                      </button>
                    </div>
                  );
                }

                if (contactLoading) {
                  return (
                    <div className="flex flex-col gap-3 p-4 bg-[#F2EFE6] rounded-xl">
                      {sectionLabel}
                      <div className="h-5 w-2/3 bg-[#E3DFD1] rounded animate-pulse" />
                      <div className="h-10 w-full bg-[#E3DFD1] rounded-lg animate-pulse" />
                    </div>
                  );
                }

                if (contactError || !revealedContact) {
                  return (
                    <div className="flex flex-col gap-3 p-4 bg-[#F2EFE6] rounded-xl">
                      {sectionLabel}
                      <p className="text-[13px] text-[#C23B3B] m-0 leading-snug">
                        {contactError || t.errorGeneral}
                      </p>
                    </div>
                  );
                }

                const contactInfo = getContactLinkAndLabel(revealedContact.contact, revealedContact.contact_type);
                const contact2Info = revealedContact.contact2
                  ? getContactLinkAndLabel(revealedContact.contact2, revealedContact.contact2_type)
                  : null;
                const actionLabel = (isTg: boolean) => isTg
                  ? (locale === "uz" ? "Telegramda ochish ↗" : locale === "ru" ? "Открыть в Telegram ↗" : "Open in Telegram ↗")
                  : (locale === "uz" ? "Qo'ng'iroq qilish ✆" : locale === "ru" ? "Позвонить ✆" : "Call ✆");

                return (
                  <div className="flex flex-col gap-3 p-4 bg-[#F2EFE6] rounded-xl">
                    {sectionLabel}

                    {/* Values side by side, each with its own copy button */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-between gap-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 font-mono text-sm font-bold min-w-0">
                          {contactInfo.isTelegram ? (
                            <Send className="w-3.5 h-3.5 text-[#2A4B8D] flex-shrink-0" />
                          ) : (
                            <Phone className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          )}
                          <span className={`truncate ${contactInfo.isTelegram ? "text-[#2A4B8D]" : "text-emerald-700"}`}>
                            {revealedContact.contact}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyContact(revealedContact.contact)}
                          className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-[#D8D3C4] bg-white text-[#8A8F98] hover:text-[#1B2A4A] hover:border-[#1B2A4A] transition-all"
                          title={t.contactHelpCopyText || "Kontaktni nusxalash"}
                        >
                          {contactCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {revealedContact.contact2 && contact2Info && (
                        <div className="flex items-center justify-between gap-1.5 flex-1 min-w-0 border-l border-[#D8D3C4] pl-2">
                          <div className="flex items-center gap-1.5 font-mono text-sm font-bold min-w-0">
                            {contact2Info.isTelegram ? (
                              <Send className="w-3.5 h-3.5 text-[#2A4B8D] flex-shrink-0" />
                            ) : (
                              <Phone className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            )}
                            <span className={`truncate ${contact2Info.isTelegram ? "text-[#2A4B8D]" : "text-emerald-700"}`}>
                              {revealedContact.contact2}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyContact(revealedContact.contact2!)}
                            className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-[#D8D3C4] bg-white text-[#8A8F98] hover:text-[#1B2A4A] hover:border-[#1B2A4A] transition-all"
                            title={t.contactHelpCopyText || "Kontaktni nusxalash"}
                          >
                            {contactCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Action buttons stacked underneath */}
                    <div className="flex flex-col gap-2">
                      <a
                        href={contactInfo.url}
                        target={contactInfo.isTelegram ? "_blank" : undefined}
                        rel="noreferrer"
                        className={`font-mono text-xs px-4 py-2.5 rounded-lg font-bold text-center flex items-center justify-center gap-2 transition-all w-full ${
                          contactInfo.isTelegram
                            ? "bg-[#2A4B8D] hover:bg-[#1B2A4A] text-[#FCFBF6]"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                        id="contact-action-btn"
                      >
                        {contactInfo.isTelegram ? <Send className="w-4 h-4 flex-shrink-0" /> : <Phone className="w-4 h-4 flex-shrink-0" />}
                        <span className="truncate">{actionLabel(contactInfo.isTelegram)}</span>
                      </a>

                      {revealedContact.contact2 && contact2Info && (
                        <a
                          href={contact2Info.url}
                          target={contact2Info.isTelegram ? "_blank" : undefined}
                          rel="noreferrer"
                          className={`font-mono text-xs px-4 py-2.5 rounded-lg font-bold text-center flex items-center justify-center gap-2 transition-all w-full ${
                            contact2Info.isTelegram
                              ? "bg-[#2A4B8D] hover:bg-[#1B2A4A] text-[#FCFBF6]"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          }`}
                        >
                          {contact2Info.isTelegram ? <Send className="w-4 h-4 flex-shrink-0" /> : <Phone className="w-4 h-4 flex-shrink-0" />}
                          <span className="truncate">{actionLabel(contact2Info.isTelegram)}</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification for successful post creation */}
      {createdToastOpen && (
        <div 
          id="post-created-toast"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-[#1B2A4A] text-white px-5 py-3.5 rounded-xl shadow-2xl border border-white/10 flex items-center gap-3.5 animate-popin transition-all"
          style={{ width: "90%", maxWidth: "420px" }}
        >
          <div className="w-8 h-8 rounded-full bg-[#C79A3E]/20 text-[#C79A3E] flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-[#C79A3E]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold m-0">{t.toastPostCreated}</p>
          </div>
          <button 
            type="button"
            onClick={() => setCreatedToastOpen(false)}
            className="text-white/60 hover:text-white bg-transparent border-none p-1 rounded-full cursor-pointer hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
export { App };
