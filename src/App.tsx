import React, { useState, useEffect } from "react";
import { Post, Locale, PostType } from "./types";
import { translations, defaultLocale } from "./translations";
import { KOREA_CITIES } from "./constants";
import { BoardingPass } from "./components/BoardingPass";
import { PostFormModal } from "./components/PostFormModal";
import { LoginModal } from "./components/LoginModal";
import { ProfileSheet } from "./components/ProfileSheet";
import { supabaseBrowser } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { Send, Globe, ShieldAlert, Sparkles, MessageSquare, Briefcase, Package, X, Phone, Share2, Check, Copy, User, Trash2 } from "lucide-react";

const LOCALE_LABELS: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
  en: "English",
};

// Traveler posts store the luggage count as a neutral "chamadon" token
// regardless of the author's locale (see PostFormModal). Re-localize it here
// from the count so it matches the viewer's current locale rather than
// freezing to whichever language the post was created in.
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
  const [filter, setFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [contactCopied, setContactCopied] = useState(false);
  const [createdToastOpen, setCreatedToastOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(8);
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

  // Reset visible posts count when filter changes to avoid confusion
  useEffect(() => {
    setVisibleCount(8);
  }, [filter]);

  // Active translation dictionary
  const t = translations[locale];

  // Handle URL deep linking
  useEffect(() => {
    if (posts.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const postIdParam = params.get("postId") || params.get("post");
      if (postIdParam) {
        const found = posts.find((p) => String(p.id) === postIdParam);
        if (found) {
          setSelectedPost(found);
        }
      }
    }
  }, [posts]);

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
    const shareText = selectedPost.type === "traveler"
      ? `Elchi: ${selectedPost.from_city} → ${selectedPost.to_city} (${shareWeight}) uchyapman. Bog'lanish: ${selectedPost.contact}`
      : `Elchi: ${selectedPost.from_city} → ${selectedPost.to_city} (${shareWeight}) pochta yuborish kerak. Bog'lanish: ${selectedPost.contact}`;

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

  // Fetch posts from our Express API
  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/posts");
      if (res.ok) {
        const data = await res.json();
        // Ensure posts are sorted by created_at in descending order (most recent first)
        const sorted = Array.isArray(data) 
          ? [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          : [];
        setPosts(sorted);
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("elchi_locale", newLocale);
  };

  // Filter posts locally
  const filteredPosts = posts.filter((post) => {
    if (filter === "all") return true;

    const isFromKorea = KOREA_CITIES.some(c => c.toLowerCase() === post.from_city.toLowerCase());

    if (filter === "k2u") return isFromKorea;
    if (filter === "u2k") return !isFromKorea;
    return true;
  });

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

  // Helper to construct Telegram or Contact link
  const getContactLinkAndLabel = (contactStr: string) => {
    const trimmed = contactStr.trim();
    if (trimmed.startsWith("@")) {
      const username = trimmed.substring(1);
      return {
        url: `https://t.me/${username}`,
        label: trimmed,
        isTelegram: true,
      };
    }
    return {
      url: `tel:${trimmed}`,
      label: trimmed,
      isTelegram: false,
    };
  };

  // Human-friendly date inside detail modal
  const formatDetailDate = (dateStr: string) => {
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

  // Flights only run between Korea and Uzbekistan — the headline shows that country
  // route, while the traveler's actual city is shown separately
  const getHubRoute = (fromCity: string) => {
    const isFromKorea = KOREA_CITIES.some(c => c.toLowerCase() === fromCity.toLowerCase());
    return { hubFrom: isFromKorea ? t.korea : t.uzbekistan, hubTo: isFromKorea ? t.uzbekistan : t.korea };
  };

  return (
    <div className="min-h-screen pb-[120px] bg-[#F2EFE6] text-[#1B2A4A] relative">
      {/* Airmail stripes at the very top */}
      <div className="h-2 bg-[repeating-linear-gradient(-45deg,#C23B3B_0_12px,#FCFBF6_12px_17px,#2A4B8D_17px_29px,#FCFBF6_29px_34px)]"></div>

      {/* Header / Navbar */}
      <header className="bg-[#FCFBF6]/90 backdrop-blur-md border-b border-[#E4E0D2] sticky top-0 z-40 shadow-sm">
        <div className="max-w-[680px] mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
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
              {filteredPosts.length} {t.activeCount}
            </span>
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setFilter("all")}
              className={`font-mono text-xs px-3.5 py-1.5 border rounded-full transition-all flex-shrink-0 ${
                filter === "all"
                  ? "bg-[#1B2A4A] text-[#FCFBF6] border-[#1B2A4A] font-bold"
                  : "bg-[#FCFBF6] text-[#1B2A4A] border-[#D8D3C4] hover:border-[#1B2A4A]"
              }`}
            >
              {t.allPosts}
            </button>
            <button
              onClick={() => setFilter("k2u")}
              className={`font-mono text-xs px-3.5 py-1.5 border rounded-full transition-all flex-shrink-0 ${
                filter === "k2u"
                  ? "bg-[#1B2A4A] text-[#FCFBF6] border-[#1B2A4A] font-bold"
                  : "bg-[#FCFBF6] text-[#1B2A4A] border-[#D8D3C4] hover:border-[#1B2A4A]"
              }`}
            >
              {t.koreaToUzbekistan}
            </button>
            <button
              onClick={() => setFilter("u2k")}
              className={`font-mono text-xs px-3.5 py-1.5 border rounded-full transition-all flex-shrink-0 ${
                filter === "u2k"
                  ? "bg-[#1B2A4A] text-[#FCFBF6] border-[#1B2A4A] font-bold"
                  : "bg-[#FCFBF6] text-[#1B2A4A] border-[#D8D3C4] hover:border-[#1B2A4A]"
              }`}
            >
              {t.uzbekistanToKorea}
            </button>
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
          ) : filteredPosts.length > 0 ? (
            <div className="flex flex-col gap-4">
              {filteredPosts.slice(0, visibleCount).map((post) => (
                <BoardingPass
                  key={post.id}
                  post={post}
                  t={t}
                  locale={locale}
                  onOpen={() => setSelectedPost(post)}
                />
              ))}

              {filteredPosts.length > visibleCount ? (
                <div className="mt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 8)}
                    className="font-mono text-xs font-bold py-3 px-6 bg-[#FCFBF6] border border-[#D8D3C4] hover:border-[#2A4B8D] hover:text-[#2A4B8D] rounded-xl text-[#1B2A4A] flex items-center gap-2 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                  >
                    <span>{t.loadMoreBtn || "Yana yuklash ↓"}</span>
                  </button>
                </div>
              ) : filteredPosts.length > 8 ? (
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
          <div className="mt-8 p-5 bg-[#FCFBF6] border border-[#E9E5D8] border-l-4 border-l-[#C79A3E] rounded-r-xl text-[13px] text-[#6B7280] leading-relaxed shadow-sm">
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

              {/* Destinations (flight route is always Korea/Uzbekistan) */}
              {(() => {
                const { hubFrom, hubTo } = getHubRoute(selectedPost.from_city);
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

                {session?.user?.id && selectedPost.user_id === session.user.id && (
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
                const contactInfo = getContactLinkAndLabel(selectedPost.contact);
                const contact2Info = selectedPost.contact2 ? getContactLinkAndLabel(selectedPost.contact2) : null;
                const actionLabel = (isTg: boolean) => isTg
                  ? (locale === "uz" ? "Telegramda ochish ↗" : locale === "ru" ? "Открыть в Telegram ↗" : "Open in Telegram ↗")
                  : (locale === "uz" ? "Qo'ng'iroq qilish ✆" : locale === "ru" ? "Позвонить ✆" : "Call ✆");

                return (
                  <div className="flex flex-col gap-3 p-4 bg-[#F2EFE6] rounded-xl">
                    <div className="font-mono text-[10px] tracking-wider uppercase text-[#8A8F98]">
                      {t.contactLabel}
                    </div>

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
                            {selectedPost.contact}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyContact(selectedPost.contact)}
                          className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-[#D8D3C4] bg-white text-[#8A8F98] hover:text-[#1B2A4A] hover:border-[#1B2A4A] transition-all"
                          title={t.contactHelpCopyText || "Kontaktni nusxalash"}
                        >
                          {contactCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {selectedPost.contact2 && contact2Info && (
                        <div className="flex items-center justify-between gap-1.5 flex-1 min-w-0 border-l border-[#D8D3C4] pl-2">
                          <div className="flex items-center gap-1.5 font-mono text-sm font-bold min-w-0">
                            {contact2Info.isTelegram ? (
                              <Send className="w-3.5 h-3.5 text-[#2A4B8D] flex-shrink-0" />
                            ) : (
                              <Phone className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            )}
                            <span className={`truncate ${contact2Info.isTelegram ? "text-[#2A4B8D]" : "text-emerald-700"}`}>
                              {selectedPost.contact2}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyContact(selectedPost.contact2!)}
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

                      {selectedPost.contact2 && contact2Info && (
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
