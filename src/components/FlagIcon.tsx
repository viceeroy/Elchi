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
      // Drawn to the Taegukgi's actual construction rather than by eye. The
      // flag is 3:2 with the origin at the centre, so every measurement below
      // is the spec's own: taegeuk diameter = half the flag height (r = 24),
      // trigram bars 24 long and 4 thick on the 33.69° diagonals, set half a
      // taegeuk radius clear of the circle. The hand-placed version this
      // replaced had the trigrams rotated the wrong way and sized by feel.
      return (
        <svg viewBox="-72 -48 144 96" className={cls} style={style} role="img" aria-label="Korea">
          <path fill="#FFFFFF" d="M-72-48v96H72v-96z" />
          {/* Trigrams. Each bar is a stroked vertical line; the two groups are
              the two diagonals, so ☰/☵ ride one and ☲/☷ the other. */}
          <g stroke="#000000" strokeWidth="4">
            <path
              transform="rotate(33.69006752598)"
              d="M-50-12v24m6 0v-24m6 0v24m76 0V1m0-2v-11m6 0v11m0 2v11m6 0V1m0-2v-11"
            />
            <path
              transform="rotate(-33.69006752598)"
              d="M-50-12v24m6 0V1m0-2v-11m6 0v24m76 0V1m0-2v-11m6 0v24m6 0V1m0-2v-11"
            />
          </g>
          {/* Taegeuk — red above blue, tilted onto the same diagonal */}
          <g transform="rotate(33.69006752598)">
            <path fill="#CD2E3A" d="M12 0a18 18 0 11-36 0 24 24 0 1148 0" />
            <path fill="#0047A0" d="M-24 0a24 24 0 1048 0A12 12 0 100 0a12 12 0 11-24 0" />
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
          style={{ ...style, display: "inline-block", background: "var(--color-rule)" }}
          aria-hidden="true"
        />
      );
  }
};
