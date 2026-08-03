import React from "react";

interface FlagIconProps {
  /** ISO 3166-1 alpha-2 code from the COUNTRIES registry. */
  iso: string;
  className?: string;
}

// Flags are drawn inline rather than pulled from emoji: Windows Chrome and Edge
// render regional-indicator pairs as bare letters ("KR"), so an emoji flag would
// silently degrade to text for a large share of visitors.
//
// A country in COUNTRIES without art here falls through to a neutral swatch, so
// switching on one of the commented-out corridors never renders a hole. Add the
// real flag alongside it when that corridor launches.
export const FlagIcon: React.FC<FlagIconProps> = ({ iso, className }) => {
  const cls = `shrink-0 rounded-[2px] ${className ?? "w-[22px] h-[15px]"}`;
  // Hairline keeps a white-heavy flag (Korea) from bleeding into the cream page.
  const style = { boxShadow: "inset 0 0 0 0.5px rgba(27,42,74,0.15)" };

  switch (iso) {
    case "KR":
      return (
        <svg viewBox="0 0 30 20" className={cls} style={style} role="img" aria-label="Korea">
          <rect width="30" height="20" fill="#FFFFFF" />
          {/* Taegeuk — red over blue, tilted as on the real flag */}
          <g transform="rotate(-33.69 15 10)">
            <path d="M15 5.6a4.4 4.4 0 0 1 0 8.8 2.2 2.2 0 0 1 0-4.4 2.2 2.2 0 0 0 0-4.4z" fill="#CD2E3A" />
            <path d="M15 5.6a4.4 4.4 0 0 0 0 8.8 2.2 2.2 0 0 0 0-4.4 2.2 2.2 0 0 1 0-4.4z" fill="#0047A0" />
          </g>
          {/* Four trigrams, simplified to their bar groupings */}
          <g fill="#000000">
            {/* ☰ upper hoist */}
            <g transform="translate(3.4 2.6) rotate(33.69)">
              <rect width="5" height="0.9" />
              <rect y="1.5" width="5" height="0.9" />
              <rect y="3" width="5" height="0.9" />
            </g>
            {/* ☷ lower fly */}
            <g transform="translate(21.6 13.5) rotate(33.69)">
              <rect width="2.1" height="0.9" />
              <rect x="2.9" width="2.1" height="0.9" />
              <rect y="1.5" width="2.1" height="0.9" />
              <rect x="2.9" y="1.5" width="2.1" height="0.9" />
              <rect y="3" width="2.1" height="0.9" />
              <rect x="2.9" y="3" width="2.1" height="0.9" />
            </g>
            {/* ☵ lower hoist */}
            <g transform="translate(4.6 16.6) rotate(-33.69)">
              <rect width="2.1" height="0.9" />
              <rect x="2.9" width="2.1" height="0.9" />
              <rect y="1.5" width="5" height="0.9" />
              <rect y="3" width="2.1" height="0.9" />
              <rect x="2.9" y="3" width="2.1" height="0.9" />
            </g>
            {/* ☲ upper fly */}
            <g transform="translate(22.8 0.7) rotate(-33.69)">
              <rect width="5" height="0.9" />
              <rect y="1.5" width="2.1" height="0.9" />
              <rect x="2.9" y="1.5" width="2.1" height="0.9" />
              <rect y="3" width="5" height="0.9" />
            </g>
          </g>
        </svg>
      );

    case "UZ":
      return (
        <svg viewBox="0 0 30 20" className={cls} style={style} role="img" aria-label="Uzbekistan">
          <rect width="30" height="20" fill="#FFFFFF" />
          <rect width="30" height="6.2" fill="#0099B5" />
          <rect y="13.8" width="30" height="6.2" fill="#1EB53A" />
          {/* Thin red fringes between the bands */}
          <rect y="6.2" width="30" height="0.5" fill="#CE1126" />
          <rect y="13.3" width="30" height="0.5" fill="#CE1126" />
          {/* Crescent in the hoist — a white disc with a blue disc offset over it */}
          <circle cx="5" cy="3.1" r="2.6" fill="#FFFFFF" />
          <circle cx="6.1" cy="3.1" r="2.15" fill="#0099B5" />
          {/* Twelve stars in the 3 / 4 / 5 arrangement of the real flag, drawn as
              discs — a five-pointed star is mush below ~2px */}
          <g fill="#FFFFFF">
            <circle cx="10.4" cy="1.4" r="0.42" />
            <circle cx="12.4" cy="1.4" r="0.42" />
            <circle cx="14.4" cy="1.4" r="0.42" />
            <circle cx="10.4" cy="3.1" r="0.42" />
            <circle cx="12.4" cy="3.1" r="0.42" />
            <circle cx="14.4" cy="3.1" r="0.42" />
            <circle cx="16.4" cy="3.1" r="0.42" />
            <circle cx="10.4" cy="4.8" r="0.42" />
            <circle cx="12.4" cy="4.8" r="0.42" />
            <circle cx="14.4" cy="4.8" r="0.42" />
            <circle cx="16.4" cy="4.8" r="0.42" />
            <circle cx="18.4" cy="4.8" r="0.42" />
          </g>
        </svg>
      );

    default:
      return (
        <span
          className={cls}
          style={{ ...style, display: "inline-block", background: "#E4E0D2" }}
          aria-hidden="true"
        />
      );
  }
};
