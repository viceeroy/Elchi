import React, { useEffect, useRef, useState } from "react";
import { Locale } from "../types";
import { SELECTABLE_COUNTRIES, Country } from "../constants";
import { FlagIcon } from "./FlagIcon";

// Country options come from the COUNTRIES registry in constants.ts — adding a
// country there makes it appear in the dropdown automatically.
//
// The control picks a CORRIDOR, not a direction. Uzbekistan is on one side of
// every corridor the board serves, so it is never listed here: the viewer picks
// the far country, and the feed then shows that corridor in both directions.
// Which way a given parcel travels is content on the post card, not a filter.

interface CountryInfo {
  code: string; // IATA airport code shown big
  city: string; // localized hub city for the dropdown
  country: string; // localized country name shown under the code
  iso: string; // ISO country code from the registry
}

interface RouteSelectorProps {
  locale: Locale;
  countryCode: string; // ISO code of the far side of the corridor
  onChange: (countryCode: string) => void;
}

export const RouteSelector: React.FC<RouteSelectorProps> = ({
  locale,
  countryCode,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toInfo = (c: Country): CountryInfo => ({
    code: c.airport,
    city: c.cityNames[locale],
    country: c.names[locale],
    iso: c.code,
  });
  const options = SELECTABLE_COUNTRIES.map(toInfo);
  const selected = options.find((o) => o.iso === countryCode) ?? options[0];

  const selectCountry = (picked: CountryInfo) => {
    setOpen(false);
    if (picked.iso === selected.iso) return;
    onChange(picked.iso);
  };

  return (
    <div ref={rootRef} className="relative flex items-center justify-end py-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Davlat: ${selected.country}`}
        aria-expanded={open}
        className="group/side flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer max-w-full min-w-0"
      >
        <FlagIcon iso={selected.iso} className="w-[20px] h-[14px] sm:w-[24px] sm:h-[16px]" />
        <span className="font-bold text-[13px] sm:text-[17px] leading-none text-ink group-hover/side:text-blue transition-colors truncate">
          {selected.country}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-[#B9B4A5] group-hover/side:text-blue transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Country dropdown */}
      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-30 bg-card border border-rule rounded-xl shadow-lg py-1.5 min-w-[180px]">
          {options.map((c) => {
            const active = c.iso === selected.iso;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => selectCountry(c)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-left transition-colors ${
                  active ? "bg-paper" : "hover:bg-paper"
                }`}
              >
                <span className="flex items-center gap-2">
                  <FlagIcon iso={c.iso} className="w-[18px] h-[13px]" />
                  <span className="flex flex-col">
                    <span className={`text-[13px] ${active ? "font-bold" : "font-semibold"} text-ink`}>
                      {c.country}
                    </span>
                    <span className="text-[11px] text-faint">{c.city}</span>
                  </span>
                </span>
                <span className="font-mono text-[11px] font-bold tracking-[1px] text-gold">
                  {c.code}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
