import React, { useState } from "react";
import { Post, Locale, Translations } from "../types";
import { AlertTriangle, Briefcase, Package, Send, Phone } from "lucide-react";

interface BoardingPassProps {
  post: Post;
  t: Translations;
  locale: Locale;
  onOpen: () => void;
  onReport: (postId: string) => void;
}

export const BoardingPass: React.FC<BoardingPassProps> = ({
  post,
  t,
  locale,
  onOpen,
  onReport,
}) => {
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);

  const handleReport = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering open card modal
    if (reported || reporting) return;

    if (!confirm(t.reportBtn + "?")) return;

    setReporting(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: post.id }),
      });
      if (response.ok) {
        setReported(true);
        alert(t.reportedToast);
        onReport(post.id);
      } else {
        alert(t.errorGeneral);
      }
    } catch (err) {
      console.error(err);
      alert(t.errorGeneral);
    } finally {
      setReporting(false);
    }
  };

  const isTraveler = post.type === "traveler";
  const tagLabel = isTraveler ? t.travelerTag : t.requestTag;

  // Render sticker styles with distinct airmail tilt angle
  const stickerStyle = {
    position: "absolute" as const,
    top: -10,
    left: 20,
    zIndex: 10,
    fontFamily: "'Space Mono', monospace",
    fontSize: "10.5px",
    letterSpacing: "1px",
    textTransform: "uppercase" as const,
    padding: "6px 12px",
    borderRadius: 4,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    boxShadow: "0 3px 8px rgba(27,42,74,0.15)",
    border: "1px dashed rgba(255,255,255,0.4)",
    transform: isTraveler ? "rotate(-2.5deg)" : "rotate(2.0deg)",
    background: isTraveler ? "#2A4B8D" : "#C23B3B",
    color: "#FCFBF6",
  };

  // Human friendly date helper
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      
      const monthsUz = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
      const monthsRu = ['Января','Февраля','Марта','Апреля','Мая','Июня','Июля','Августа','Сентября','Октября','Ноября','Декабря'];
      const monthsEn = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      
      const day = d.getDate();
      let month = "";
      if (locale === "uz") month = monthsUz[d.getMonth()];
      else if (locale === "ru") month = monthsRu[d.getMonth()];
      else month = monthsEn[d.getMonth()];

      return `${day} ${month}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <article
      onClick={onOpen}
      className="group relative grid grid-cols-1 md:grid-cols-[1fr_135px] bg-[#FCFBF6] rounded-xl border border-[#E9E5D8] transition-all duration-300 cursor-pointer shadow-sm hover:-translate-y-1 hover:shadow-md"
      style={{
        boxShadow: "0 1px 2px rgba(27,42,74,0.04), 0 10px 28px -18px rgba(27,42,74,0.18)",
      }}
      id={`post-card-${post.id}`}
    >
      {/* Traveler or Request Tag Badge */}
      <div style={stickerStyle}>
        {isTraveler ? (
          <Briefcase className="w-3 h-3 text-[#FCFBF6]" />
        ) : (
          <Package className="w-3 h-3 text-[#FCFBF6]" />
        )}
        {tagLabel}
      </div>

      {/* Decorative Left Airmail Stripe */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-2 rounded-l-xl opacity-90 pointer-events-none"
        style={{
          background: "repeating-linear-gradient(-45deg, #2A4B8D, #2A4B8D 6px, #FCFBF6 6px, #FCFBF6 12px, #C23B3B 12px, #C23B3B 18px, #FCFBF6 18px, #FCFBF6 24px)",
          borderRight: "1px solid #E4E0D2"
        }}
      ></div>

      {/* Main Boarding Pass Content */}
      <div className="pt-8 pb-5 pl-8 pr-6 md:py-6 md:pl-10 md:pr-7 flex flex-col justify-between">
        <div>
          {/* Destination Header */}
          <div className="flex items-center gap-2.5 font-extrabold text-[19px] text-[#1B2A4A] tracking-tight mb-2">
            <span>{post.from_city}</span>
            <span className="text-[#C79A3E] flex items-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </span>
            <span>{post.to_city}</span>
          </div>

          {/* Post Details */}
          <div className="text-[13.5px] text-[#5A6272] leading-relaxed mb-3">
            <span className="text-[#1B2A4A] font-bold block md:inline mr-1">
              {post.weight}
            </span>
            <span>
              {post.price ? `· ${post.price}` : ""} {post.note ? `· ${post.note}` : ""}
            </span>
          </div>
        </div>

        {/* Footer Contact Handle & Report */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F2EFE6]">
          {post.contact.trim().startsWith("@") ? (
            <div className="flex items-center gap-1.5 font-mono text-xs text-[#2A4B8D] font-bold bg-[#E8EEF8] border border-[#D5E2F4] px-2.5 py-1 rounded-md">
              <Send className="w-3 h-3 text-[#2A4B8D]" />
              {post.contact}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 font-mono text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md">
              <Phone className="w-3 h-3 text-emerald-600" />
              {post.contact}
            </div>
          )}

          {/* Abuse Report Button */}
          <button
            onClick={handleReport}
            disabled={reported || reporting}
            className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${
              reported 
                ? "text-green-600 bg-green-50" 
                : "text-[#8A8F98] hover:text-[#C23B3B] hover:bg-red-50"
            }`}
            title={t.reportBtn}
            id={`report-btn-${post.id}`}
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ticket Tear-off Divider and Punch Notches (Tablet & Desktop only) */}
      <div className="hidden md:block absolute right-[135px] top-3 bottom-3 w-0 border-l-2 border-dashed border-[#E4E0D2] pointer-events-none"></div>
      
      {/* Decorative Ticket Punch Holes (Notches) */}
      <div className="hidden md:block absolute right-[127px] -top-2.5 w-4 h-4 bg-[#F2EFE6] border border-[#E9E5D8] rounded-full pointer-events-none"></div>
      <div className="hidden md:block absolute right-[127px] -bottom-2.5 w-4 h-4 bg-[#F2EFE6] border border-[#E9E5D8] rounded-full pointer-events-none"></div>

      {/* Right Ticket Stub (Date and Call to Action) */}
      <div className="rounded-b-xl md:rounded-b-none md:rounded-r-xl bg-[#1B2A4A] text-[#FCFBF6] px-5 py-5 md:py-6 md:px-4 flex flex-row md:flex-col justify-between items-center md:items-stretch relative">
        {/* Notches for mobile borders */}
        <div className="md:hidden absolute left-[15%] -top-2 w-4 h-4 bg-[#F2EFE6] border border-[#E9E5D8] rounded-full"></div>
        <div className="md:hidden absolute right-[15%] -top-2 w-4 h-4 bg-[#F2EFE6] border border-[#E9E5D8] rounded-full"></div>

        <div className="flex flex-col gap-0.5 text-left md:text-center md:mt-2">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-gray-400">
            {t.stubLabel}
          </span>
          <span className="font-mono text-[14px] md:text-[15px] font-bold mt-0.5 text-[#FCFBF6]">
            {formatDate(post.date)}
          </span>
          <span className="font-sans text-[11px] font-semibold text-[#C79A3E] mt-1 flex items-center gap-1 md:justify-center">
            <span className="text-[9px]">➔</span> {post.to_city}
          </span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="font-mono text-[11px] bg-[#C79A3E] text-[#1B2A4A] border-none py-2 px-4 md:px-2 rounded-md font-bold cursor-pointer tracking-wider hover:bg-[#D9AC50] transition-colors shadow-sm"
          id={`stub-btn-${post.id}`}
        >
          {t.contactBtn.replace(" →", "")}
        </button>
      </div>
    </article>
  );
};
export default BoardingPass;
