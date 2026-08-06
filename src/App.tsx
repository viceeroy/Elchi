import React, { useState, useEffect, lazy, Suspense } from "react";
import { Post, PostContact, Locale, PostType, ContactMethod } from "./types";
import { telegramUsername, phoneDialString } from "../lib/contact";
import { replaceLuggageToken } from "../lib/weight";
import { formatFlexibleDate } from "../lib/formatDate";
import { translations, defaultLocale, pluralizeChamadon } from "./translations";
import { COUNTRIES, getCountry, isHubCity } from "./constants";
import { BoardingPass } from "./components/BoardingPass";
import {
  FEED_CARD_SHELL,
  FEED_CARD_INNER,
  FEED_CARD_FOOTER_ROW,
} from "./components/FeedCard";
import { RouteSelector } from "./components/RouteSelector";
import { PostFab } from "./components/PostFab";
import { TypedHeadline } from "./components/TypedHeadline";
import { NotesCarousel, type Note } from "./notes";
import { useDialog } from "./hooks/useDialog";
import { useAnnouncer } from "./hooks/useAnnouncer";
import { supabaseBrowser } from "./supabaseClient";
// From auth-js, not the supabase-js umbrella: src no longer depends on the
// umbrella at all (see supabaseClient.ts), and a type-only import back to it
// invites someone to "tidy" it into a value import and quietly restore 86 kB.
import type { Session } from "@supabase/auth-js";
import { Send, ShieldAlert, Sparkles, MessageSquare, Plane, Briefcase, X, Phone, Share2, Check, Copy, User, Trash2, Lock } from "lucide-react";
import elchiLogo from "./assets/logo/elchi-logo-icon.svg";

// Every one of these is a modal or a bottom sheet: none of them is on screen at
// first paint, and most visitors never open any of them — the board is a
// read-mostly noticeboard, and three of the five are behind a login the average
// reader does not have. Shipping them in the entry chunk made the first render
// of the feed wait on code for screens that were never requested. They are
// already rendered conditionally, so splitting them costs no extra unmounting
// logic; it only stops the bytes travelling.
//
// React.lazy wants a default export and this codebase uses named exports
// throughout (see the component convention in CLAUDE.md), hence the
// `.then(m => ({ default: m.X }))` on each. NoteSheet is imported from its own
// module rather than the ./notes barrel so the chunk doesn't drag in
// NotesCarousel and the notes data, which the first screen already needs — and
// despite the name it is an editorial card from ./notes, nothing to do with
// posting.
const PostFormModal = lazy(() =>
  import("./components/PostFormModal").then((m) => ({ default: m.PostFormModal })),
);
const LoginModal = lazy(() =>
  import("./components/LoginModal").then((m) => ({ default: m.LoginModal })),
);
const NameGateModal = lazy(() =>
  import("./components/NameGateModal").then((m) => ({ default: m.NameGateModal })),
);
const ProfileSheet = lazy(() =>
  import("./components/ProfileSheet").then((m) => ({ default: m.ProfileSheet })),
);
const NoteSheet = lazy(() =>
  import("./notes/NoteSheet").then((m) => ({ default: m.NoteSheet })),
);

// Warms the composer chunk before it is rendered. Splitting the sheet moves its
// download from "before first paint" to "when tapped", and on a slow connection
// that trades a faster feed for a sheet that hangs after the tap. The speed dial
// gives us the gap to avoid it: opening it is a separate tap that always
// precedes picking a side, so the fetch starts while the user is still
// choosing. Calling this is fire-and-forget — the import is cached by the
// bundler runtime, and a failed prefetch is not an error worth surfacing
// because the real render retries the same import.
function prefetchComposers() {
  void import("./components/PostFormModal").catch(() => {});
}

// The scrim every sheet renders behind itself, shown on its own while a chunk
// is still in flight. Without it a tap on a slow connection looks ignored: the
// old code had the component in hand and painted instantly. This is not a
// spinner on purpose — the sheets animate up from the bottom over exactly this
// backdrop, so on a fast connection the fallback is indistinguishable from the
// first frame of the sheet itself rather than a flash of unrelated UI.
const SheetFallback: React.FC = () => (
  <div
    className="fixed inset-0 bg-ink/45 backdrop-blur-[3px] z-[100] animate-[fadein_0.2s_ease]"
    aria-hidden="true"
  />
);

// Traveler posts store the luggage count as a neutral "chamadon" token
// (see PostFormModal). Expand it here from the count so it reads as a proper
// Uzbek phrase rather than the raw token the composer wrote.
// The feed is paged server-side, so a bounded response can't be turned into a
// full dump of the board.
const PAGE_SIZE = 24;

function localizeWeight(weight: string): string {
  return replaceLuggageToken(weight, pluralizeChamadon);
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
  // Whether the session above is an ANSWER or merely the initial guess. `null`
  // is a valid resolved value (logged out), so the state alone cannot say which
  // it is — and the feed effect below has to know, or it fires once for
  // "unknown" and again for the real session.
  const [authResolved, setAuthResolved] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // Whether the logged-in viewer still owes us a display name. Three states,
  // not a boolean: "unknown" is the window between a session appearing and the
  // profile lookup answering, and flashing a blocking name sheet at a user who
  // already has a name would be worse than the short wait.
  const [nameState, setNameState] = useState<"unknown" | "ok" | "needed">("unknown");
  // Which side of the form to open once login completes — posting is gated
  // behind auth, so the choice made at the speed dial has to survive the modal.
  const pendingComposeRef = React.useRef<PostType | null>(null);

  // Track auth session so add-post can be gated behind Telegram login
  useEffect(() => {
    // Mark the session resolved even when the lookup fails: the feed waits on
    // this flag, so a rejected getSession() must degrade to "logged out" rather
    // than leave the board stuck on its skeleton forever.
    supabaseBrowser.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((err) => console.error("Error reading session:", err))
      .finally(() => setAuthResolved(true));
    const { data: listener } = supabaseBrowser.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      // supabase-js emits INITIAL_SESSION on init, which can beat the promise
      // above. Either path is an answer.
      setAuthResolved(true);
      // Strip leftover OAuth hash (#access_token / bare #) from URL bar
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Does this account have a display name yet? Runs on every login, not on
  // signup: the column has existed for a while and every account that predates
  // the capture gate has it NULL, so the only reliable moment to ask is when a
  // session shows up. Once the name is stored the query answers "ok" and the
  // gate never appears again.
  //
  // Read from `profiles` directly rather than from session.user_metadata: the
  // metadata copy is whatever the provider handed over at signup and is not
  // updated when the gate writes, so trusting it would re-prompt forever.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setNameState("unknown");
      return;
    }
    let cancelled = false;
    supabaseBrowser
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // A failed lookup must not lock the board behind a name sheet the
          // user cannot answer their way out of. Degrade to "has a name" — the
          // next login asks again, and the card fallback covers the display.
          console.error("Error reading profile name:", error);
          setNameState("ok");
          return;
        }
        const name = (data as { display_name: string | null } | null)?.display_name;
        setNameState(name && name.trim() ? "ok" : "needed");
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // The gate is up whenever a session exists and its profile has no name. It
  // sits above every other sheet and has no dismissal, so this also stands in
  // for "the app is blocked" wherever that matters (the scroll lock below).
  const nameGateOpen = Boolean(session) && nameState === "needed";

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

  // Screen-reader announcements for the asynchronous state changes below —
  // the contact reveal, the copy buttons, the toast and the delete. All of
  // them used to change only pixels.
  const { announce, announceError, liveRegions } = useAnnouncer();

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
  //
  // Login and the profile sheet are in the list too. They were missing, which
  // left the feed scrollable behind the two sheets a logged-out visitor is most
  // likely to meet first. Nesting is safe: opening login over the detail sheet
  // re-runs this effect, and cleanup + setup happen in the same commit, so the
  // body is unfixed and re-fixed at the same offset without a paint between.
  useEffect(() => {
    const isModalOpen =
      selectedPost !== null ||
      selectedNote !== null ||
      formOpen ||
      loginOpen ||
      profileOpen ||
      nameGateOpen;
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
  }, [selectedPost, selectedNote, formOpen, loginOpen, profileOpen, nameGateOpen]);

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

  // The detail sheet is inline JSX rather than its own component, so its focus
  // management is wired here and told when the sheet is up. Everything else in
  // the app mounts and unmounts, and calls useDialog with no second argument.
  const detailPanelRef = useDialog<HTMLDivElement>(closeDetailModal, selectedPost !== null);

  const handleShare = async () => {
    if (!selectedPost) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}?postId=${selectedPost.id}`;
    const shareWeight = localizeWeight(selectedPost.weight);
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
      announce(t.shareSuccess || "Havola nusxalandi!");
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
      announce(t.shareSuccess || "Havola nusxalandi!");
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const handleCopyContact = async (text: string) => {
    // Both paths end in the same visual tell — the icon flips to a check — so
    // both announce. The announcement is what a screen-reader user gets
    // instead of that check.
    try {
      await navigator.clipboard.writeText(text);
      setContactCopied(true);
      announce(t.srCopied || "Nusxalandi");
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
      announce(t.srCopied || "Nusxalandi");
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
        // No `type` any more: the board has one kind of post, so the API
        // narrows to it unconditionally. The corridor filter still runs in SQL
        // so paging stays correct — a client-side filter would leave the
        // offsets counting rows the user can't see.
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

  // Refetch from page 1 whenever the corridor changes, and when the session
  // changes so is_mine is recomputed for the new viewer.
  //
  // The wait on authResolved is what stops a returning visitor fetching the
  // whole feed twice on every load. `session` starts null, so this effect used
  // to fire once with no viewer, then again the moment getSession() came back
  // with one and `session?.user?.id` went undefined → uuid. Two full pages over
  // the wire, the second landing late enough to visibly replace the first.
  //
  // Waiting costs nothing: fetchPosts already awaits getSession() itself before
  // it can attach the bearer token, so the request was never going out ahead of
  // the session anyway — the first fetch was pure waste, not a head start.
  useEffect(() => {
    if (!authResolved) return;
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResolved, country, session?.user?.id]);

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

  // Speak the outcome of that fetch. The handles themselves are read out, not
  // just "contact ready": they are the entire payload of the reveal, and a
  // screen-reader user would otherwise have to go hunting for what changed.
  // Announced from an effect rather than inside the fetch so the DOM the
  // message describes is already committed when the region updates.
  useEffect(() => {
    if (!revealedContact) return;
    const handles = [revealedContact.contact, revealedContact.contact2]
      .filter(Boolean)
      .join(", ");
    announce(`${t.srContactRevealed || "Kontakt ochildi"}: ${handles}`);
  }, [revealedContact, announce, t.srContactRevealed]);

  // Assertive, unlike everything else here: a failed reveal is a dead end, and
  // the user needs to know before they keep pressing.
  useEffect(() => {
    if (contactError) announceError(contactError);
  }, [contactError, announceError]);

  const setToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    // The toast is the only confirmation that a post went up, and it appears
    // without taking focus and removes itself after four seconds — a screen
    // reader would never encounter it. Announcing here rather than putting
    // aria-live on the toast element keeps the timing right: the toast mounts
    // together with its text, which is exactly the case a live region does not
    // reliably catch.
    announce(message);
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
        // Deleting is the one action with no confirmation of any kind: the
        // sheet closes and the feed silently reloads without the post. A
        // sighted user infers it from the row disappearing; this says it.
        announce(t.srPostDeleted || "E'lon o'chirildi");
      } else {
        console.error("Failed to delete post", await res.text());
        announceError(t.errorGeneral);
      }
    } catch (err) {
      console.error("Error deleting post:", err);
      announceError(t.errorGeneral);
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
  const formatDetailDate = (dateStr: string | null) => formatFlexibleDate(dateStr, "long", t.months);

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
      {/* Both live regions, mounted for the life of the app and empty until
          something is announced. They render nothing visible. */}
      {liveRegions}

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
          {/* Types itself out once on mount. This used to be keyed on the feed
              tab so the headline replayed on every switch; with one feed left
              there is nothing to switch between, and an unkeyed instance types
              exactly once. */}
          <h1 className="text-3xl sm:text-4xl leading-[1.05] font-black m-0 mb-2 tracking-tight">
            <TypedHeadline
              segments={[
                { text: t.title, className: "text-red" },
                // Kept as its own line on phones, as before the animation.
                { text: t.titleAccent, className: "block sm:inline" },
              ]}
            />
          </h1>
        </section>

        {/* Posts Filter and Feed */}
        <section className="pt-2">
          {/* Route line. The two-way parcel/notes chip selector that used to sit
              beside it came off with the announcement board — one kind of post
              means nothing to select between, and a lone always-active chip is
              a label pretending to be a control. */}
          <div className="mb-5 flex items-center justify-end gap-3">
            <RouteSelector
              locale={locale}
              countryCode={country}
              onChange={setCountry}
            />
          </div>

          {/* The board's own explainer. Not a post: no author, no contact, and
              unaffected by the route filter — a new visitor should meet it
              whichever corridor they land on. */}
          <NotesCarousel locale={locale} onOpenNote={setSelectedNote} />

          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                /* Borrows the real cards' chrome by name rather than tracing it:
                   a skeleton of a different silhouette makes the feed jump when
                   the posts land, and a hand-copied one drifts (this was still
                   drawing the retired two-column stub card long after the stub
                   came off). Not a FeedCard — no click target, no stripe, no
                   post — so it takes the class strings and adds the pulse. */
                <div
                  key={i}
                  className={`${FEED_CARD_SHELL} overflow-hidden animate-pulse`}
                >
                  <div className={FEED_CARD_INNER}>
                    {/* badge + route */}
                    <div className="h-6 w-2/3 bg-edge rounded" />
                    {/* city line */}
                    <div className="h-3 w-1/3 bg-rule rounded" />
                    {/* date · weight */}
                    <div className="h-4 w-2/5 bg-edge rounded" />
                    {/* note, two lines */}
                    <div className="h-3.5 w-full bg-rule rounded" />
                    <div className="h-3.5 w-4/5 bg-rule rounded" />

                    <div className={FEED_CARD_FOOTER_ROW}>
                      <div className="h-3.5 w-20 bg-rule rounded" />
                      <div className="h-[27px] w-24 bg-edge rounded-md" />
                    </div>
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
          <div className="mt-6 p-3 bg-card border border-edge border-l-4 border-l-gold rounded-r-xl text-[13px] text-body leading-snug shadow-sm">
            <span className="font-bold text-ink mr-1">{t.disclaimerTitle}</span>
            {t.disclaimerText}
          </div>
        </section>
      </main>

      {/* Floating composer — the "+" fans out into the two sides of a parcel ad */}
      <PostFab
        t={t}
        open={fabOpen}
        onToggle={(open) => {
          // Start pulling the composer chunks as the dial fans out, not after
          // the user has picked a side. See prefetchComposers.
          if (open) prefetchComposers();
          setFabOpen(open);
        }}
        onPickTraveler={() => handleComposeClick("traveler")}
        onPickRequest={() => handleComposeClick("request")}
      />

      {/* Post Creation Bottom Sheet Modal */}
      {formOpen && session && (
        <Suspense fallback={<SheetFallback />}>
          <PostFormModal
            t={t}
            locale={locale}
            initialType={composeType}
            onClose={() => setFormOpen(false)}
            onSubmitSuccess={handlePostSubmitSuccess}
          />
        </Suspense>
      )}

      {/* Login Modal — Telegram only, required to add a post */}
      {loginOpen && (
        <Suspense fallback={<SheetFallback />}>
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
        </Suspense>
      )}

      {/* Name gate — the one sheet in the app that cannot be dismissed. Last in
          the overlay stack and at a higher z-index than the rest, because it
          has to cover a composer that was opened by the same login that
          triggered it. */}
      {nameGateOpen && session && (
        <Suspense fallback={<SheetFallback />}>
          <NameGateModal
            t={t}
            userId={session.user.id}
            // Only ever called once the write came back with a row, so this is
            // a confirmed state change rather than an optimistic one. The
            // refetch is what puts the new name on the author's own cards —
            // the feed effect is keyed on the viewer's id, not on their name,
            // so already-rendered cards would otherwise keep the fallback
            // until the next reload.
            onSaved={() => {
              setNameState("ok");
              fetchPosts();
            }}
          />
        </Suspense>
      )}

      {/* Profile Bottom Sheet — shown when the logged-in user taps the profile icon */}
      {profileOpen && session && (
        <Suspense fallback={<SheetFallback />}>
          <ProfileSheet
            t={t}
            session={session}
            onClose={() => setProfileOpen(false)}
            onSignOut={() => setProfileOpen(false)}
          />
        </Suspense>
      )}

      {/* Board note expanded view */}
      {selectedNote && (
        <Suspense fallback={<SheetFallback />}>
          <NoteSheet
            note={selectedNote}
            locale={locale}
            onClose={() => setSelectedNote(null)}
          />
        </Suspense>
      )}

      {/* Post Detail Viewer Bottom Sheet Modal */}
      {selectedPost && (
        <div 
          className="fixed inset-0 bg-ink/45 backdrop-blur-[3px] flex items-end justify-center z-[100] animate-[fadein_0.2s_ease]"
          onClick={(e) => e.target === e.currentTarget && closeDetailModal()}
        >
          <div
            ref={detailPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t.postDetailsTitle || "E'lon tafsilotlari"}
            tabIndex={-1}
            className="bg-card w-full max-w-[560px] rounded-t-2xl pb-8 max-h-[88vh] overflow-y-auto shadow-2xl animate-[slideup_0.28s_cubic-bezier(0.2,0.8,0.2,1)] relative outline-none"
          >

            {/* Header portion inside card format */}
            <div className="bg-ink text-card px-6 pt-4 pb-7 relative rounded-t-2xl">
              <div className="w-10 h-1 bg-white/25 rounded-full mx-auto mb-5" aria-hidden="true"></div>
              <button
                onClick={closeDetailModal}
                aria-label={t.closeLabel || "Yopish"}
                className="absolute right-[18px] top-[16px] bg-white/10 hover:bg-white/20 border-none w-8 h-8 rounded-full flex items-center justify-center text-card transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
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
                {selectedPost.type === "traveler" ? (
                  <Plane className="w-3.5 h-3.5 text-ink" />
                ) : (
                  <Briefcase className="w-3.5 h-3.5 text-ink" />
                )}
                {selectedPost.type === "traveler" ? t.travelerTag : t.requestTag}
              </div>

              {(() => {
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
              })()}
              <div className="font-mono text-xs opacity-70 mt-1.5 tracking-wider">
                {selectedPost.type === "traveler" ? t.dateLabelTraveler : t.dateLabelRequest} · {formatDetailDate(selectedPost.date)}
              </div>
            </div>

            {/* Body of details */}
            <div className="px-6 pt-6">
              <div className="bg-paper rounded-xl p-3.5 mb-5">
                <div className="font-mono text-[10px] tracking-wider uppercase text-blue mb-1">{selectedPost.type === "traveler" ? t.weightLabelTraveler : t.weightLabelRequest}</div>
                <div className="font-bold text-base text-ink">{localizeWeight(selectedPost.weight)}</div>
              </div>

              {/* The note reads as the post's body, so it is set as body copy and
                  nothing else: no label above it, no panel around it, no accent
                  rule down its left edge. All three were framing that made a
                  remark look like a pull-quote sitting inside the sheet rather
                  than part of it.

                  No max-height and no overflow either. It used to cap at 40vh
                  and scroll inside its own box, which put a second scrollbar
                  inside a sheet that already scrolls (max-h-[88vh] on the panel)
                  — a long note trapped the reader in an inner pane. It now runs
                  its full length and the sheet scrolls it, like any other
                  section here. */}
              {selectedPost.note && (
                <div className="mb-5">
                  <div className="text-[14px] text-body leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap italic">
                    {`"${selectedPost.note}"`}
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
                    <Check className="w-4 h-4 text-green animate-[bounce_0.2s_ease-in-out]" />
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
                      <p className="text-[13px] text-body m-0 leading-snug">
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
                    // aria-busy marks the section as mid-update, so a screen
                    // reader can say the region is loading rather than reading
                    // two empty skeleton bars. The arrival itself is announced
                    // from the effect above.
                    <div className="flex flex-col gap-3 p-4 bg-paper rounded-xl" aria-busy="true">
                      {sectionLabel}
                      <div className="h-5 w-2/3 bg-[#E3DFD1] rounded animate-pulse" aria-hidden="true" />
                      <div className="h-10 w-full bg-[#E3DFD1] rounded-lg animate-pulse" aria-hidden="true" />
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
                            <Phone className="w-3.5 h-3.5 text-green flex-shrink-0" />
                          )}
                          <span className={`truncate ${contactInfo.isTelegram ? "text-blue" : "text-green"}`}>
                            {revealedContact.contact}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyContact(revealedContact.contact)}
                          className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-field bg-white text-faint hover:text-ink hover:border-ink transition-all"
                          title={t.contactHelpCopyText || "Kontaktni nusxalash"}
                          aria-label={t.copyContactLabel || "Kontaktni nusxalash"}
                        >
                          {contactCopied ? <Check className="w-4 h-4 text-green" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {revealedContact.contact2 && contact2Info && (
                        <div className="flex items-center justify-between gap-1.5 flex-1 min-w-0 border-l border-field pl-2">
                          <div className="flex items-center gap-1.5 font-mono text-sm font-bold min-w-0">
                            {contact2Info.isTelegram ? (
                              <Send className="w-3.5 h-3.5 text-blue flex-shrink-0" />
                            ) : (
                              <Phone className="w-3.5 h-3.5 text-green flex-shrink-0" />
                            )}
                            <span className={`truncate ${contact2Info.isTelegram ? "text-blue" : "text-green"}`}>
                              {revealedContact.contact2}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyContact(revealedContact.contact2!)}
                            className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-field bg-white text-faint hover:text-ink hover:border-ink transition-all"
                            title={t.contactHelpCopyText || "Kontaktni nusxalash"}
                            aria-label={t.copyContactLabel || "Kontaktni nusxalash"}
                          >
                            {contactCopied ? <Check className="w-4 h-4 text-green" /> : <Copy className="w-4 h-4" />}
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
                            : "bg-green hover:bg-green-deep text-white"
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
                              : "bg-green hover:bg-green-deep text-white"
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
            aria-label={t.dismissLabel || "Yopish"}
            className="text-white/60 hover:text-white bg-transparent border-none p-1 rounded-full cursor-pointer hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
