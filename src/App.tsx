import React, { useState, useEffect } from "react";
import { Post, Locale, PostType } from "./types";
import { translations, defaultLocale } from "./translations";
import { BoardingPass } from "./components/BoardingPass";
import { PostFormModal } from "./components/PostFormModal";
import { Send, Globe, ShieldAlert, Sparkles, MessageSquare, Briefcase, Package, X, Phone, Share2, Check } from "lucide-react";

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
  const [showTooltip, setShowTooltip] = useState(false);
  const [createdToastOpen, setCreatedToastOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(8);

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

  const closeDetailModal = () => {
    setSelectedPost(null);
    setShareCopied(false);
    setContactCopied(false);
    setShowTooltip(false);
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
    const shareText = selectedPost.type === "traveler"
      ? `Elchi: ${selectedPost.from_city} → ${selectedPost.to_city} (${selectedPost.weight}) uchyapman. Bog'lanish: ${selectedPost.contact}`
      : `Elchi: ${selectedPost.from_city} → ${selectedPost.to_city} (${selectedPost.weight}) pochta yuborish kerak. Bog'lanish: ${selectedPost.contact}`;

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
    
    const koreaCities = [
      "Seoul", "Ansan", "Busan", "Incheon", "Dangjin", "Daegu", "Daejeon", "Gwangju", "Ulsan", 
      "Cheonan", "Suwon", "Changwon", "Gimhae", "Cheongju", "Gumi", "Jeonju", "Pyeongtaek", "Hwaseong"
    ];
    
    const isFromKorea = koreaCities.some(c => c.toLowerCase() === post.from_city.toLowerCase());
    
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

  return (
    <div className="min-h-screen pb-[120px] bg-[#F2EFE6] text-[#1B2A4A] relative">
      {/* Airmail stripes at the very top */}
      <div className="h-2 bg-[repeating-linear-gradient(-45deg,#C23B3B_0_12px,#FCFBF6_12px_17px,#2A4B8D_17px_29px,#FCFBF6_29px_34px)]"></div>

      {/* Header / Navbar */}
      <header className="bg-[#FCFBF6]/90 backdrop-blur-md border-b border-[#E4E0D2] sticky top-0 z-40 shadow-sm">
        <div className="max-w-[680px] mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img 
              src="/src/assets/images/elchi_logo_1784445722506.jpg" 
              alt="Elchi Logo" 
              className="w-7 h-7 rounded-lg object-cover border border-[#E4E0D2] shadow-sm"
              referrerPolicy="no-referrer"
            />
            <span className="font-extrabold text-[19px] tracking-tight text-[#1B2A4A]">Elchi</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Route strip indicator */}
            <span className="hidden sm:inline font-mono text-[11px] tracking-widest text-[#8A8F98]">SEL ⇄ TAS</span>
            
            {/* Language Switcher */}
            <div className="flex bg-[#F2EFE6] border border-[#E4E0D2] rounded-lg p-0.5 gap-0.5">
              {(["uz", "ru", "en"] as Locale[]).map((loc) => (
                <button
                  key={loc}
                  onClick={() => changeLocale(loc)}
                  className={`text-[11px] font-bold px-2 py-1 rounded-md transition-all ${
                    locale === loc
                      ? "bg-[#1B2A4A] text-[#FCFBF6] shadow-sm"
                      : "text-[#5A6272] hover:text-[#1B2A4A]"
                  }`}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Board Container */}
      <main className="max-w-[680px] mx-auto px-5">
        
        {/* Hero Section */}
        <section className="pt-10 pb-6">
          <div className="font-mono text-[10.5px] tracking-[2px] uppercase text-[#2A4B8D] font-bold mb-3.5">
            {t.tagline}
          </div>
          <h1 className="text-4xl sm:text-[46px] leading-[1.05] font-black m-0 mb-4 tracking-tight">
            {t.title}
            <span className="text-[#C23B3B] block sm:inline">{t.titleAccent}</span>
          </h1>

          {/* Route Strip Visual Panel */}
          <div className="mt-8 bg-[#FCFBF6] border border-[#E4E0D2] rounded-2xl p-5 sm:px-6 sm:py-5 flex items-center gap-5 shadow-sm">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xl font-bold tracking-wider">SEL</span>
              <span className="text-[11px] text-[#8A8F98] font-semibold">Seoul</span>
            </div>
            
            <div className="flex-1 relative h-0.5 bg-[linear-gradient(90deg,#C8C2AF_0_6px,transparent_6px_12px)] bg-[length:12px_2px]">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#FCFBF6] px-2 text-[#C79A3E] flex">
                <Send className="w-4 h-4 transform rotate-45" />
              </span>
            </div>

            <div className="flex flex-col gap-0.5 items-end">
              <span className="font-mono text-xl font-bold tracking-wider">TAS</span>
              <span className="text-[11px] text-[#8A8F98] font-semibold">Tashkent</span>
            </div>
          </div>
        </section>

        {/* Posts Filter and Feed */}
        <section className="pt-8">
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
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B2A4A]"></div>
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
                  onReport={() => fetchPosts()}
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
              <p className="text-[15px] font-bold text-[#1B2A4A] m-0 mb-1">E'lonlar topilmadi</p>
              <p className="text-sm text-[#8A8F98] m-0">Hozircha ushbu yo'nalishda faol e'lonlar mavjud emas.</p>
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
          onClick={() => setFormOpen(true)}
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

              {/* Destinations */}
              <div className="flex items-center gap-3 font-black text-2xl tracking-tight mt-3">
                <span>{selectedPost.from_city}</span>
                <span className="text-[#C79A3E] flex items-center">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </span>
                <span>{selectedPost.to_city}</span>
              </div>
              <div className="font-mono text-xs opacity-70 mt-1.5 tracking-wider">
                {selectedPost.type === "traveler" ? t.dateLabelTraveler : t.dateLabelRequest} · {formatDetailDate(selectedPost.date)}
              </div>
            </div>

            {/* Body of details */}
            <div className="px-6 pt-6">
              <div className="grid grid-cols-2 gap-3.5 mb-5">
                <div className="bg-[#F2EFE6] rounded-xl p-3.5">
                  <div className="font-mono text-[10px] tracking-wider uppercase text-[#2A4B8D] mb-1">{selectedPost.type === "traveler" ? t.weightLabelTraveler : t.weightLabelRequest}</div>
                  <div className="font-bold text-base text-[#1B2A4A]">{selectedPost.weight}</div>
                </div>
                <div className="bg-[#F2EFE6] rounded-xl p-3.5">
                  <div className="font-mono text-[10px] tracking-wider uppercase text-[#2A4B8D] mb-1">{t.priceLabel.replace(" (ixtiyoriy)", "")}</div>
                  <div className="font-bold text-base text-[#1B2A4A]">{selectedPost.price || "Kelishiladi / Negotiable"}</div>
                </div>
              </div>

              {selectedPost.note && (
                <div className="mb-5">
                  <div className="font-mono text-[10px] tracking-wider uppercase text-[#2A4B8D] mb-2">{t.noteLabel.replace(" (ixtiyoriy)", "")}</div>
                  <div className="text-[14px] text-[#3A4256] leading-relaxed bg-[#FCFBF6] border border-[#E9E5D8] border-l-4 border-l-[#C79A3E] p-4 rounded-r-lg italic">
                    "{selectedPost.note}"
                  </div>
                </div>
              )}

              {/* Share Button Section */}
              <div className="mb-5">
                <button
                  onClick={handleShare}
                  className="w-full font-mono text-xs py-3 px-4 bg-[#FCFBF6] border border-[#D8D3C4] hover:border-[#2A4B8D] rounded-xl text-[#1B2A4A] font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
                  id="share-post-btn"
                >
                  {shareCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600 animate-[bounce_0.2s_ease-in-out]" />
                      <span className="text-emerald-700 font-bold">{t.shareSuccess || "Havola nusxalandi!"}</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 text-[#C79A3E]" />
                      <span>{t.shareBtn || "Ulashish"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Action and Contact segment */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#F2EFE6] rounded-xl">
                <div 
                  onClick={() => handleCopyContact(selectedPost.contact)}
                  className="cursor-pointer hover:bg-[#E9E5D8]/60 px-2.5 py-1.5 -mx-2.5 -my-1.5 rounded-lg transition-all group/contact relative flex flex-col"
                  title={locale === "uz" ? "Nusxalash uchun bosing" : locale === "ru" ? "Нажмите для копирования" : "Click to copy"}
                >
                  <div className="font-mono text-[10px] tracking-wider uppercase text-[#8A8F98] mb-0.5 flex items-center justify-between w-full gap-3">
                    <span>{t.contactLabel}</span>
                    <span className="text-[9px] opacity-0 group-hover/contact:opacity-100 text-[#C79A3E] transition-opacity font-bold">
                      {contactCopied ? (t.contactHelpCopied || "Nusxalandi!") : (locale === "uz" ? "nusxalash" : locale === "ru" ? "копировать" : "copy")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-[#1B2A4A]">
                    {selectedPost.contact.trim().startsWith("@") ? (
                      <>
                        <Send className="w-3.5 h-3.5 text-[#2A4B8D]" />
                        <span className="text-[#2A4B8D] group-hover/contact:underline">{selectedPost.contact}</span>
                      </>
                    ) : (
                      <>
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 group-hover/contact:underline">{selectedPost.contact}</span>
                      </>
                    )}
                    {contactCopied && (
                      <Check className="w-3.5 h-3.5 text-emerald-600 animate-[bounce_0.2s_ease-in-out]" />
                    )}
                  </div>
                </div>
                
                {(() => {
                  const contactInfo = getContactLinkAndLabel(selectedPost.contact);
                  const isTg = contactInfo.isTelegram;
                  
                  // Label translations helper
                  let buttonLabel = "";
                  if (isTg) {
                    buttonLabel = locale === "uz" ? "Telegramda ochish ↗" : locale === "ru" ? "Открыть в Telegram ↗" : "Open in Telegram ↗";
                  } else {
                    buttonLabel = locale === "uz" ? "Qo'ng'iroq qilish ✆" : locale === "ru" ? "Позвонить ✆" : "Call ✆";
                  }

                  return (
                    <div className="relative flex flex-col items-stretch sm:items-end group w-full sm:w-auto">
                      {/* Visual Tooltip Container */}
                      <div className={`absolute bottom-full mb-2.5 right-0 left-0 sm:left-auto sm:w-[260px] bg-[#1B2A4A] text-white rounded-xl shadow-xl p-3.5 text-xs font-sans leading-normal z-50 transition-all duration-200 pointer-events-auto transform origin-bottom ${showTooltip ? "scale-100 opacity-100 visible" : "scale-95 opacity-0 invisible group-hover:scale-100 group-hover:opacity-100 group-hover:visible"}`}>
                        <div className="font-bold text-[#C79A3E] mb-1 flex items-center gap-1">
                          <span>💡</span>
                          <span>{t.contactHelpTitle || "Bog'lanish bo'yicha yordam"}</span>
                        </div>
                        <p className="text-[11px] text-slate-200 mb-2">
                          {t.contactHelpText || "Agar tugma ishlamasa, chap tomondagi kontaktni bosib nusxa oling yoki ushbu kontaktni nusxalash uchun bosing."}
                        </p>
                        
                        {/* Copy Button in Tooltip */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleCopyContact(selectedPost.contact);
                          }}
                          className="w-full text-center bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white font-mono text-[10px] font-bold py-1.5 px-2 rounded border border-white/15 flex items-center justify-center gap-1.5"
                        >
                          {contactCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 font-bold">{t.contactHelpCopied || "Nusxalandi!"}</span>
                            </>
                          ) : (
                            <>
                              {isTg ? <Send className="w-3 h-3 text-sky-300" /> : <Phone className="w-3 h-3 text-emerald-400" />}
                              <span>{t.contactHelpCopyText || "Kontaktni nusxalash"}</span>
                            </>
                          )}
                        </button>
                        
                        {/* Tiny Arrow */}
                        <div className="absolute top-full right-1/2 translate-x-1/2 sm:right-8 sm:translate-x-0 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1B2A4A]"></div>
                      </div>

                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <a
                          href={contactInfo.url}
                          target={isTg ? "_blank" : undefined}
                          rel="noreferrer"
                          className={`font-mono text-xs px-5 py-3 rounded-lg font-bold text-center flex items-center justify-center gap-2 transition-all flex-1 sm:flex-initial ${
                            isTg 
                              ? "bg-[#2A4B8D] hover:bg-[#1B2A4A] text-[#FCFBF6]" 
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          }`}
                          id="contact-action-btn"
                        >
                          {isTg ? <Send className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                          {buttonLabel}
                        </a>
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setShowTooltip(!showTooltip);
                          }}
                          className={`h-10 w-10 flex items-center justify-center rounded-lg border transition-all ${
                            showTooltip 
                              ? "bg-[#1B2A4A] border-[#1B2A4A] text-white" 
                              : "bg-white border-[#D8D3C4] text-[#8A8F98] hover:text-[#1B2A4A] hover:border-[#1B2A4A]"
                          }`}
                          title={t.contactHelpTitle || "Yordam"}
                        >
                          <span className="font-bold text-xs">?</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
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
