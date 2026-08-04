import React, { useState, useEffect } from "react";
import { Post, PostContact, Locale, PostType, ContactMethod } from "./types";
import { telegramUsername, phoneDialString } from "../lib/contact";
import { translations, defaultLocale } from "./translations";
import { COUNTRIES, getCountry, isHubCity } from "./constants";
import { BoardingPass } from "./components/BoardingPass";
import { AnnouncementCard } from "./components/AnnouncementCard";
import { RouteSelector } from "./components/RouteSelector";
import { PostFormModal } from "./components/PostFormModal";
import { NoteFormModal } from "./components/NoteFormModal";
import { PostFab } from "./components/PostFab";
import { LoginModal } from "./components/LoginModal";
import { ProfileSheet } from "./components/ProfileSheet";
import { TypedHeadline } from "./components/TypedHeadline";
import { NotesCarousel, NoteSheet, type Note } from "./notes";
import { supabaseBrowser } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { Send, ShieldAlert, Sparkles, MessageSquare, Briefcase, Package, Megaphone, X, Phone, Share2, Check, Copy, User, Trash2, Lock } from "lucide-react";
import elchiLogo from "./assets/logo/elchi-logo-icon.svg";

// Traveler posts store the luggage count as a neutral "chamadon" token
// (see PostFormModal). Expand it here from the count so it reads as a proper
// Uzbek phrase rather than the raw token the composer wrote.
// The feed is paged server-side, so a bounded response can't be turned into a
// full dump of the board.
const PAGE_SIZE = 24;

function localizeWeight(weight: string): string {
  return weight.replace(/(\d+)\s*chamadon\b/gi, (_match, numStr: string) => {
    const n = parseInt(numStr, 10);
    return `${n} ${n === 1 ? "chamadon" : "ta chamadon"}`;
  });
}

export default function App() {
  // The site serves an Uzbek-speaking audience only, so the language is fixed.
  // The translations table and the country registry keep their per-locale shape,
  // so the components that look names up in them still take a `locale` — there
  // is simply nothing that switches it.
  const locale: Locale = defaultLocale;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  // Corridor filter — the ISO code of the far country, picked in the
  // RouteSelector. Uzbekistan is the other side of every corridor, so it is
  // implied. Both directions of the corridor are shown; which way a parcel
  // travels is content on the post, not something the feed filters by.
  // Defaults to the main corridor, Korea ↔ Uzbekistan.
  const [country, setCountry] = useState<string>("KR");
  const [formOpen, setFormOpen] = useState(false);
  // Which tab the composer opens on, set by the speed dial before the sheet
  // mounts. The user can still switch inside the form.
  const [composeType, setComposeType] = useState<PostType>("traveler");
  // Feed filter — exactly one of the two kinds is always showing. There is no
  // "everything" state: parcel ads and standing service ads read so differently
  // that a mixed feed was mostly noise, and the cleared chip left the user on a
  // list they hadn't asked for. So the chips are a two-way selector, not a pair
  // of toggles, and picking the active one is a no-op rather than a clear.
  const [feedFilter, setFeedFilter] = useState<"parcel" | "notes">("parcel");
  // Speed-dial state for the floating "+"
  const [fabOpen, setFabOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  // Board notes are static editorial cards, not feed content — kept here only so
  // the open sheet shares the same body scroll lock as the other modals.
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [contactCopied, setContactCopied] = useState(false);
  // Confirmation toast. Holds the message rather than a flag, because the two
  // composers confirm with different copy.
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Contact handles for the open post. Never part of the feed payload — fetched
  // on demand, and only for logged-in viewers.
  const [revealedContact, setRevealedContact] = useState<PostContact | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // Which side of the form to open once login completes — posting is gated
  // behind auth, so the choice made at the speed dial has to survive the modal.
  const pendingComposeRef = React.useRef<PostType | null>(null);

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

  const openComposer = (kind: PostType) => {
    setComposeType(kind);
    setFormOpen(true);
  };

  // Signing out — or a refresh token that finally expires — while a composer or
  // the profile sheet is open leaves an authenticated-only surface on screen.
  // The submit would come back 401 and the profile sheet reads its user off a
  // session that no longer exists, so both close with the session.
  useEffect(() => {
    if (session) return;
    setFormOpen(false);
    setProfileOpen(false);
    pendingComposeRef.current = null;
  }, [session]);

  // Posting requires an account, with no dev escape hatch. There used to be a
  // REQUIRE_LOGIN_TO_POST flag here that turned the gate off; it left the
  // composer openable to a logged-out visitor who then filled the whole form
  // and met a bare 401 on submit — the API has always required the token. The
  // gate is now the same on both sides.
  const handleComposeClick = (kind: PostType) => {
    if (session) {
      openComposer(kind);
    } else {
      pendingComposeRef.current = kind;
      setLoginOpen(true);
    }
  };

  // Active translation dictionary
  const t = translations[locale];

  // The document title, meta description and <html lang> are the Uzbek strings
  // already shipped in the static index.html, so there is nothing to sync at
  // runtime.

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
    const isModalOpen =
      selectedPost !== null || selectedNote !== null || formOpen;
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
  }, [selectedPost, selectedNote, formOpen]);

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
    const shareWeight = localizeWeight(selectedPost.weight);
    // The contact handle is deliberately left out of the share text: it would
    // republish someone's phone number into whatever app the link is sent to.
    // The recipient opens the post and reveals it themselves.
    //
    // A note has no cities and no cargo, so it shares its own text rather than
    // the parcel sentence, which would render as "undefined → …". Its theme is
    // optional, so the body is the fallback — and the only text at all on a
    // note whose author skipped it.
    const shareText = selectedPost.type === "announcement"
      ? `Elchi: ${selectedPost.headline || selectedPost.note || ""}`.trim()
      : selectedPost.type === "traveler"
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
        country,
        // Filtering happens in SQL so paging stays correct — a client-side
        // filter would leave the offsets counting rows the user can't see.
        // The chips are exhaustive, so "all" is never requested from here; the
        // API still supports it for other callers.
        type: feedFilter === "parcel" ? "parcel" : "announcement",
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
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  // Refetch from page 1 whenever the corridor or the feed filter changes, and
  // when the session changes so is_mine is recomputed for the new viewer.
  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, feedFilter, session?.user?.id]);

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

  const setToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 4000);
  };

  // Drop a pending dismissal if the app unmounts while a toast is up.
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const handlePostSubmitSuccess = () => {
    setFormOpen(false);
    fetchPosts(); // Refresh feed with the new post
    setToast(t.toastPostCreated);
  };

  // Same refresh, its own confirmation — "your ad is up" reads wrong for
  // something the author thinks of as a note.
  const handleNoteSubmitSuccess = () => {
    setFormOpen(false);
    fetchPosts();
    setToast(t.toastNoteCreated || t.toastPostCreated);
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
  const formatDetailDate = (dateStr: string | null) => {
    // Null is how "no fixed date" is stored. The "flexible" string is the older
    // wire form, kept so rows written before that changed still read correctly.
    if (!dateStr || dateStr === "flexible") {
      return "Kelishiladi";
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;

      return `${d.getDate()}-${t.months[d.getMonth()]}, ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  // Route headline = localized country names from the stored ISO codes. The
  // registry entries come back alongside the names so the caller can also ask
  // whether the post's cities are just those countries' hubs.
  const getHubRoute = (post: Post) => {
    const from = getCountry(post.from_country) ?? COUNTRIES[0];
    const to = getCountry(post.to_country) ?? COUNTRIES.find((c) => c.code !== from.code)!;
    return { from, to, hubFrom: from.names[locale], hubTo: to.names[locale] };
  };

  return (
    <div className="min-h-screen pb-[120px] bg-paper text-ink relative">
      {/* Airmail stripes at the very top */}
      <div className="h-2 bg-[repeating-linear-gradient(-45deg,var(--color-red)_0_12px,var(--color-card)_12px_17px,var(--color-blue)_17px_29px,var(--color-card)_29px_34px)]"></div>

      {/* Header / Navbar */}
      <header className="bg-card/90 backdrop-blur-md border-b border-rule sticky top-0 z-40 shadow-sm">
        <div className="max-w-[680px] mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={elchiLogo} alt="" className="h-7 w-auto" />
            <span className="font-extrabold text-[19px] tracking-tight text-ink">Elchi</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (session) {
                  setProfileOpen(true);
                } else {
                  pendingComposeRef.current = null;
                  setLoginOpen(true);
                }
              }}
              aria-label={t.profileMenuLabel || "Profile"}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-rule bg-paper text-ink hover:border-ink transition-all"
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
          {/* The headline belongs to the active tab and types itself out on
              every switch. `key` is the whole replay mechanism: a new tab means
              a new instance, which starts empty and types from zero. */}
          <h1 className="text-3xl sm:text-4xl leading-[1.05] font-black m-0 mb-2 tracking-tight">
            <TypedHeadline
              key={feedFilter}
              segments={
                feedFilter === "parcel"
                  ? [
                      { text: t.title, className: "text-red" },
                      // Kept as its own line on phones, as before the animation.
                      { text: t.titleAccent, className: "block sm:inline" },
                    ]
                  : [
                      { text: t.notesTitleBrand || "Elchi", className: "text-red" },
                      // Deep navy, the same ink the parcel headline's accent
                      // carries — `text-blue` sat a shade too light next to it.
                      {
                        text: t.notesTitleRest || " - bepul e'lonlar taxtasi",
                        className: "text-ink",
                      },
                    ]
              }
            />
          </h1>
        </section>

        {/* Posts Filter and Feed */}
        <section className="pt-2">
          {/* Route line + feed filter chips. Picking a country filters the feed;
              the chips pick which of the two kinds it shows. One is always
              active — there is no "clear" affordance, because there is no
              unfiltered feed to clear back to. */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <div
              role="radiogroup"
              className="flex bg-paper border border-edge rounded-lg p-0.5 gap-0.5 flex-shrink-0"
            >
              <button
                type="button"
                role="radio"
                onClick={() => setFeedFilter("parcel")}
                aria-checked={feedFilter === "parcel"}
                className={`px-3 py-1.5 rounded-md font-bold text-[11px] sm:text-xs transition-all ${
                  feedFilter === "parcel"
                    ? "bg-ink text-card shadow-sm"
                    : "text-body hover:text-ink"
                }`}
              >
                {t.feedTabParcelLabel || "Pochta"}
              </button>
              <button
                type="button"
                role="radio"
                onClick={() => setFeedFilter("notes")}
                aria-checked={feedFilter === "notes"}
                className={`px-3 py-1.5 rounded-md font-bold text-[11px] sm:text-xs transition-all ${
                  feedFilter === "notes"
                    ? "bg-gold text-ink shadow-sm"
                    : "text-body hover:text-ink"
                }`}
              >
                {t.feedTabNotesLabel || "E'lonlar"}
              </button>
            </div>

            <RouteSelector
              locale={locale}
              countryCode={country}
              onChange={setCountry}
            />
          </div>

          {/* The board's own explainer. Not a post: no author, no contact, and
              unaffected by both the route filter and the feed chips — a new
              visitor should meet it whichever view they land on. */}
          <NotesCarousel locale={locale} onOpenNote={setSelectedNote} />

          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_88px] sm:grid-cols-[1fr_110px] md:grid-cols-[1fr_135px] min-h-[148px] bg-card rounded-xl border border-edge overflow-hidden animate-pulse shadow-[var(--shadow-card)]"
                >
                  <div className="pt-8 pb-5 pl-5 pr-3 sm:pl-8 sm:pr-6 md:py-6 md:pl-10 md:pr-7 flex flex-col gap-3">
                    <div className="h-5 w-2/3 bg-edge rounded" />
                    <div className="h-3.5 w-1/3 bg-edge rounded" />
                    <div className="h-3.5 w-4/5 bg-edge rounded mt-2" />
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
              {/* Both kinds of ad share the feed and the same card geometry;
                  only the type decides which component renders. */}
              {posts.map((post) =>
                post.type === "announcement" ? (
                  <AnnouncementCard
                    key={post.id}
                    post={post}
                    t={t}
                    onOpen={() => setSelectedPost(post)}
                  />
                ) : (
                  <BoardingPass
                    key={post.id}
                    post={post}
                    t={t}
                    locale={locale}
                    onOpen={() => setSelectedPost(post)}
                  />
                ),
              )}

              {hasMore ? (
                <div className="mt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => fetchPosts({ append: true })}
                    disabled={loadingMore}
                    className="font-mono text-xs font-bold py-3 px-6 bg-card border border-field hover:border-blue hover:text-blue rounded-xl text-ink flex items-center gap-2 transition-all shadow-sm active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span>{loadingMore ? (t.submittingBtn || "...") : (t.loadMoreBtn || "Yana yuklash ↓")}</span>
                  </button>
                </div>
              ) : posts.length > PAGE_SIZE ? (
                <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs font-mono text-faint tracking-wider py-2">
                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                  {t.allLoaded || "Barcha e'lonlar yuklandi"}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Disclaimer Banner */}
          <div className="mt-6 p-3 bg-card border border-edge border-l-4 border-l-gold rounded-r-xl text-[13px] text-[#6B7280] leading-snug shadow-sm">
            <span className="font-bold text-ink mr-1">{t.disclaimerTitle}</span>
            {t.disclaimerText}
          </div>
        </section>
      </main>

      {/* Floating composer — the "+" fans out into the two sides of a parcel ad
          and the note */}
      <PostFab
        t={t}
        open={fabOpen}
        onToggle={setFabOpen}
        onPickTraveler={() => handleComposeClick("traveler")}
        onPickRequest={() => handleComposeClick("request")}
        onPickNote={() => handleComposeClick("announcement")}
      />

      {/* Post Creation Bottom Sheet Modal. A note has almost none of a parcel
          ad's fields, so it gets its own sheet rather than a third tab that
          would hide most of the form it sits in. */}
      {formOpen && session && (
        composeType === "announcement" ? (
          <NoteFormModal
            t={t}
            country={country}
            onClose={() => setFormOpen(false)}
            onSubmitSuccess={handleNoteSubmitSuccess}
          />
        ) : (
          <PostFormModal
            t={t}
            locale={locale}
            initialType={composeType}
            onClose={() => setFormOpen(false)}
            onSubmitSuccess={handlePostSubmitSuccess}
          />
        )
      )}

      {/* Login Modal — Telegram only, required to add a post */}
      {loginOpen && (
        <LoginModal
          t={t}
          onClose={() => setLoginOpen(false)}
          onLoginSuccess={() => {
            setLoginOpen(false);
            const pending = pendingComposeRef.current;
            if (pending) {
              pendingComposeRef.current = null;
              openComposer(pending);
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

      {/* Board note expanded view */}
      {selectedNote && (
        <NoteSheet
          note={selectedNote}
          locale={locale}
          onClose={() => setSelectedNote(null)}
        />
      )}

      {/* Post Detail Viewer Bottom Sheet Modal */}
      {selectedPost && (
        <div 
          className="fixed inset-0 bg-ink/45 backdrop-blur-[3px] flex items-end justify-center z-[100] animate-[fadein_0.2s_ease]"
          onClick={(e) => e.target === e.currentTarget && closeDetailModal()}
        >
          <div className="bg-card w-full max-w-[560px] rounded-t-2xl pb-8 max-h-[88vh] overflow-y-auto shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative">
            
            {/* Header portion inside card format */}
            <div className="bg-ink text-card px-6 pt-4 pb-7 relative rounded-t-2xl">
              <div className="w-10 h-1 bg-white/25 rounded-full mx-auto mb-5"></div>
              <button
                onClick={closeDetailModal}
                className="absolute right-[18px] top-[16px] bg-white/10 hover:bg-white/20 border-none w-8 h-8 rounded-full flex items-center justify-center text-card transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div
                className="font-mono text-[10.5px] uppercase px-3 py-1.5 rounded inline-flex items-center gap-1.5"
                style={{
                  background:
                    selectedPost.type === "request" ? "var(--color-red)" : "var(--color-gold)",
                  color: "var(--color-ink)",
                  fontWeight: 700
                }}
              >
                {selectedPost.type === "announcement" ? (
                  <Megaphone className="w-3.5 h-3.5 text-ink" />
                ) : selectedPost.type === "traveler" ? (
                  <Briefcase className="w-3.5 h-3.5 text-ink" />
                ) : (
                  <Package className="w-3.5 h-3.5 text-ink" />
                )}
                {selectedPost.type === "announcement"
                  ? (t.announcementTag || "E'lon")
                  : selectedPost.type === "traveler" ? t.travelerTag : t.requestTag}
              </div>

              {/* An announcement sits in one country, so it shows that country
                  alone — no arrow, which would imply a delivery direction it
                  doesn't have. Parcel posts keep the full route. */}
              {selectedPost.type === "announcement" ? (
                <div className="font-black text-2xl tracking-tight mt-3">
                  {(getCountry(selectedPost.from_country) ?? COUNTRIES[0]).names[locale]}
                </div>
              ) : (
                (() => {
                  const { from, to, hubFrom, hubTo } = getHubRoute(selectedPost);
                  // Same rule as the feed card: the city line is extra detail
                  // under the country route, so it is hidden when both cities
                  // are only the hubs those countries already imply.
                  const showActualCities =
                    Boolean(selectedPost.from_city && selectedPost.to_city) &&
                    (!isHubCity(from, selectedPost.from_city) ||
                     !isHubCity(to, selectedPost.to_city));
                  return (
                    <>
                      <div className="flex items-center gap-3 font-black text-2xl tracking-tight mt-3">
                        <span>{hubFrom}</span>
                        <span className="text-gold flex items-center">
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
                })()
              )}
              {/* A note has no travel date. It leads with its theme when the
                  author gave one; the rest carry their whole text in the body
                  below. */}
              {selectedPost.type === "announcement" ? (
                selectedPost.headline ? (
                  <div className="font-bold text-[15px] mt-2 [overflow-wrap:anywhere]">
                    {selectedPost.headline}
                  </div>
                ) : null
              ) : (
                <div className="font-mono text-xs opacity-70 mt-1.5 tracking-wider">
                  {selectedPost.type === "traveler" ? t.dateLabelTraveler : t.dateLabelRequest} · {formatDetailDate(selectedPost.date)}
                </div>
              )}
            </div>

            {/* Body of details */}
            <div className="px-6 pt-6">
              {/* Cargo box is parcel-only — an announcement carries none. */}
              {selectedPost.type !== "announcement" && (
                <div className="bg-paper rounded-xl p-3.5 mb-5">
                  <div className="font-mono text-[10px] tracking-wider uppercase text-blue mb-1">{selectedPost.type === "traveler" ? t.weightLabelTraveler : t.weightLabelRequest}</div>
                  <div className="font-bold text-base text-ink">{localizeWeight(selectedPost.weight)}</div>
                </div>
              )}

              {selectedPost.note && (
                <div className="mb-5">
                  <div className="font-mono text-[10px] tracking-wider uppercase text-blue mb-2">
                    {selectedPost.type === "announcement"
                      ? (t.announcementBodyLabel || t.noteLabel.replace(" (ixtiyoriy)", ""))
                      : t.noteLabel.replace(" (ixtiyoriy)", "")}
                  </div>
                  {/* On an announcement this is the ad's body copy, not a remark
                      on someone else's trip, so it drops the quotes and italics. */}
                  <div
                    className={`text-[14px] text-[#3A4256] leading-relaxed bg-card border border-edge border-l-4 border-l-gold p-4 rounded-r-lg [overflow-wrap:anywhere] whitespace-pre-wrap max-h-[40vh] overflow-y-auto ${
                      selectedPost.type === "announcement" ? "" : "italic"
                    }`}
                  >
                    {selectedPost.type === "announcement" ? selectedPost.note : `"${selectedPost.note}"`}
                  </div>
                </div>
              )}

              {/* Share / Delete — icon-only, right-aligned */}
              <div className="mb-5 flex items-center justify-end gap-2">
                <button
                  onClick={handleShare}
                  title={shareCopied ? (t.shareSuccess || "Havola nusxalandi!") : (t.shareBtn || "Ulashish")}
                  aria-label={shareCopied ? (t.shareSuccess || "Havola nusxalandi!") : (t.shareBtn || "Ulashish")}
                  className="w-10 h-10 flex items-center justify-center bg-card border border-field hover:border-blue rounded-xl transition-all shadow-sm active:scale-[0.98]"
                  id="share-post-btn"
                >
                  {shareCopied ? (
                    <Check className="w-4 h-4 text-emerald-600 animate-[bounce_0.2s_ease-in-out]" />
                  ) : (
                    <Share2 className="w-4 h-4 text-gold" />
                  )}
                </button>

                {session?.user?.id && selectedPost.is_mine && (
                  <button
                    onClick={handleDeletePost}
                    disabled={deleting}
                    title={t.deleteBtn}
                    aria-label={t.deleteBtn}
                    className="w-10 h-10 flex items-center justify-center bg-card border border-field hover:border-red hover:bg-[#F7ECEC] rounded-xl text-red transition-all shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    id="delete-post-btn"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Action and Contact segment — single unified section */}
              {(() => {
                // A note may carry no contact at all. contact_type is NULL then
                // (it travels in the feed payload, the handle never does), so
                // there is nothing to reveal and no login worth prompting for.
                if (!selectedPost.contact_type) return null;

                const sectionLabel = (
                  <div className="font-mono text-[10px] tracking-wider uppercase text-faint">
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
                    <div className="flex flex-col gap-3 p-4 bg-paper rounded-xl">
                      {sectionLabel}
                      <p className="text-[13px] text-[#6B7280] m-0 leading-snug">
                        {t.contactLockedText}
                      </p>
                      <button
                        type="button"
                        onClick={() => setLoginOpen(true)}
                        className="font-mono text-xs px-4 py-2.5 rounded-lg font-bold text-center flex items-center justify-center gap-2 transition-all w-full bg-blue hover:bg-ink text-card"
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
                    <div className="flex flex-col gap-3 p-4 bg-paper rounded-xl">
                      {sectionLabel}
                      <div className="h-5 w-2/3 bg-[#E3DFD1] rounded animate-pulse" />
                      <div className="h-10 w-full bg-[#E3DFD1] rounded-lg animate-pulse" />
                    </div>
                  );
                }

                if (contactError || !revealedContact) {
                  return (
                    <div className="flex flex-col gap-3 p-4 bg-paper rounded-xl">
                      {sectionLabel}
                      <p className="text-[13px] text-red m-0 leading-snug">
                        {contactError || t.errorGeneral}
                      </p>
                    </div>
                  );
                }

                const contactInfo = getContactLinkAndLabel(revealedContact.contact, revealedContact.contact_type);
                const contact2Info = revealedContact.contact2
                  ? getContactLinkAndLabel(revealedContact.contact2, revealedContact.contact2_type)
                  : null;
                // No trailing ↗/✆ glyph: each button already renders the Send
                // or Phone icon beside the label, so the glyph only said the
                // same thing twice in a second visual language.
                const actionLabel = (isTg: boolean) =>
                  isTg ? "Telegramda ochish" : "Qo'ng'iroq qilish";

                return (
                  <div className="flex flex-col gap-3 p-4 bg-paper rounded-xl">
                    {sectionLabel}

                    {/* Values side by side, each with its own copy button */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-between gap-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 font-mono text-sm font-bold min-w-0">
                          {contactInfo.isTelegram ? (
                            <Send className="w-3.5 h-3.5 text-blue flex-shrink-0" />
                          ) : (
                            <Phone className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          )}
                          <span className={`truncate ${contactInfo.isTelegram ? "text-blue" : "text-emerald-700"}`}>
                            {revealedContact.contact}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyContact(revealedContact.contact)}
                          className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-field bg-white text-faint hover:text-ink hover:border-ink transition-all"
                          title={t.contactHelpCopyText || "Kontaktni nusxalash"}
                        >
                          {contactCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {revealedContact.contact2 && contact2Info && (
                        <div className="flex items-center justify-between gap-1.5 flex-1 min-w-0 border-l border-field pl-2">
                          <div className="flex items-center gap-1.5 font-mono text-sm font-bold min-w-0">
                            {contact2Info.isTelegram ? (
                              <Send className="w-3.5 h-3.5 text-blue flex-shrink-0" />
                            ) : (
                              <Phone className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            )}
                            <span className={`truncate ${contact2Info.isTelegram ? "text-blue" : "text-emerald-700"}`}>
                              {revealedContact.contact2}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyContact(revealedContact.contact2!)}
                            className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-field bg-white text-faint hover:text-ink hover:border-ink transition-all"
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
                            ? "bg-blue hover:bg-ink text-card"
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
                              ? "bg-blue hover:bg-ink text-card"
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
      {toastMessage && (
        <div 
          id="post-created-toast"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-ink text-white px-5 py-3.5 rounded-xl shadow-2xl border border-white/10 flex items-center gap-3.5 animate-popin transition-all"
          style={{ width: "90%", maxWidth: "420px" }}
        >
          <div className="w-8 h-8 rounded-full bg-gold/20 text-gold flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-gold" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold m-0">{toastMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-white/60 hover:text-white bg-transparent border-none p-1 rounded-full cursor-pointer hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
