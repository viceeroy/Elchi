import React, { useEffect, useRef, useState } from "react";
import { Locale } from "../types";
import { COUNTRIES, Country } from "../constants";
import { Plane, ArrowLeftRight } from "lucide-react";

// Country options come from the COUNTRIES registry in constants.ts — adding a
// country there makes it appear in both dropdowns automatically. Any pair of
// two different countries is a valid route; picking on one side the country
// already shown on the other side swaps them.

interface CountryInfo {
  code: string; // IATA airport code shown big
  city: string; // localized hub city for the dropdown
  country: string; // localized country name shown under the code
  iso: string; // ISO country code from the registry
}

interface RouteSelectorProps {
  locale: Locale;
  fromCode: string; // ISO code of the origin country
  toCode: string; // ISO code of the destination country
  onChange: (fromCode: string, toCode: string) => void;
}

export const RouteSelector: React.FC<RouteSelectorProps> = ({
  locale,
  fromCode,
  toCode,
  onChange,
}) => {
  // Which side's dropdown is open (null = closed)
  const [openSide, setOpenSide] = useState<"from" | "to" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openSide) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenSide(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openSide]);

  const toInfo = (c: Country): CountryInfo => ({
    code: c.airport,
    city: c.cityNames[locale],
    country: c.names[locale],
    iso: c.code,
  });
  const options = COUNTRIES.map(toInfo);
  const from = options.find((o) => o.iso === fromCode) ?? options[0];
  const to = options.find((o) => o.iso === toCode) ?? options[1];

  // Selecting a country for a side: picking the country already on the other
  // side swaps the route; picking the same country again is a no-op.
  const selectCountry = (side: "from" | "to", picked: CountryInfo) => {
    setOpenSide(null);
    const current = side === "from" ? from : to;
    const other = side === "from" ? to : from;
    if (picked.iso === current.iso) return;
    if (picked.iso === other.iso) {
      onChange(to.iso, from.iso);
      return;
    }
    if (side === "from") onChange(picked.iso, to.iso);
    else onChange(from.iso, picked.iso);
  };

  const swap = () => onChange(to.iso, from.iso);

  const renderSide = (side: "from" | "to", info: CountryInfo, align: "left" | "right") => (
    <div className={`relative flex flex-col ${align === "left" ? "items-start" : "items-end"}`}>
      <button
        type="button"
        onClick={() => setOpenSide(openSide === side ? null : side)}
        aria-label={`${side === "from" ? "From" : "To"}: ${info.country}`}
        aria-expanded={openSide === side}
        className={`group/side flex flex-col bg-transparent border-none p-0 cursor-pointer ${
          align === "left" ? "items-start text-left" : "items-end text-right"
        }`}
      >
        <span className="font-mono font-bold text-[26px] sm:text-[30px] leading-none tracking-[2px] text-[#1B2A4A] group-hover/side:text-[#2A4B8D] transition-colors flex items-center gap-1">
          {info.code}
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-[#B9B4A5] group-hover/side:text-[#2A4B8D] transition-transform ${openSide === side ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
        <span className="text-[12px] text-[#8A8F98] mt-1 font-medium">{info.country}</span>
      </button>

      {/* Country dropdown */}
      {openSide === side && (
        <div
          className={`absolute top-[calc(100%+8px)] z-30 bg-[#FCFBF6] border border-[#E4E0D2] rounded-xl shadow-lg py-1.5 min-w-[180px] ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {options.map((c) => {
            const active = c.iso === info.iso;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => selectCountry(side, c)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-left transition-colors ${
                  active ? "bg-[#F2EFE6]" : "hover:bg-[#F2EFE6]"
                }`}
              >
                <span className="flex flex-col">
                  <span className={`text-[13px] ${active ? "font-bold" : "font-semibold"} text-[#1B2A4A]`}>
                    {c.country}
                  </span>
                  <span className="text-[11px] text-[#8A8F98]">{c.city}</span>
                </span>
                <span className="font-mono text-[11px] font-bold tracking-[1px] text-[#C79A3E]">
                  {c.code}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="relative bg-[#FCFBF6] border border-[#E9E5D8] rounded-2xl px-5 py-4 sm:px-7 sm:py-5 flex items-center justify-between gap-3 shadow-sm"
      style={{ boxShadow: "0 1px 2px rgba(27,42,74,0.04), 0 10px 28px -18px rgba(27,42,74,0.18)" }}
    >
      {renderSide("from", from, "left")}

      {/* Dashed flight path with plane — clicking the plane swaps the direction */}
      <div className="flex-1 flex items-center gap-2 min-w-0 px-1">
        <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: "#CFCAB8" }}></div>
        <button
          type="button"
          onClick={swap}
          aria-label="Swap direction"
          title={locale === "ru" ? "Поменять направление" : locale === "en" ? "Swap direction" : "Yo'nalishni almashtirish"}
          className="bg-transparent border-none p-1 cursor-pointer text-[#C79A3E] hover:text-[#A8801F] hover:scale-110 active:scale-95 transition-transform flex flex-col items-center gap-0.5"
        >
          <Plane className="w-5 h-5 rotate-45" />
          {/* Tiny swap hint so users know the plane flips the route direction */}
          <ArrowLeftRight className="w-2.5 h-2.5 text-[#8A8F98]" />
        </button>
        <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: "#CFCAB8" }}></div>
      </div>

      {renderSide("to", to, "right")}
    </div>
  );
};

export default RouteSelector;
