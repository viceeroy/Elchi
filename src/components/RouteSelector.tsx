import React, { useEffect, useRef, useState } from "react";
import { Locale } from "../types";
import { HOME_COUNTRY, SELECTABLE_COUNTRIES, Country, getCountry } from "../constants";
import { FlagIcon } from "./FlagIcon";

// Country options come from the COUNTRIES registry in constants.ts — adding a
// country there makes it appear in the dropdown automatically.
//
// The control picks a CORRIDOR, not a direction. Uzbekistan is on one side of
// every corridor the board serves, so it is never listed here: the viewer picks
// the far country, and the feed then shows that corridor in both directions.
// Which way a given parcel travels is content on the post card, not a filter.

interface CountryOption {
  country: string;
  iso: string;
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const options: CountryOption[] = SELECTABLE_COUNTRIES.map((c: Country) => ({
    country: c.names[locale],
    iso: c.code,
  }));
  const selected = options.find((o) => o.iso === countryCode) ?? options[0];
  const homeCountry = getCountry(HOME_COUNTRY);

  const selectCountry = (picked: CountryOption) => {
    setOpen(false);
    if (picked.iso === selected.iso) return;
    onChange(picked.iso);
  };

  return (
    <div ref={rootRef} className="relative flex items-center justify-end py-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${homeCountry?.names[locale]} ↔ ${selected.country} yo'nalishi`}
        aria-expanded={open}
        className="group/side flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-edge bg-card px-2 py-1.5 text-left cursor-pointer hover:border-field transition-colors"
      >
        <FlagIcon iso={selected.iso} className="w-[20px] h-[14px] sm:w-[24px] sm:h-[16px]" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-bold text-[13px] sm:text-[14px] leading-none text-ink group-hover/side:text-blue transition-colors">
            {selected.country}
          </span>
          <span className="truncate font-mono text-[10px] leading-none text-body">
            ↔ {homeCountry?.names[locale]}
          </span>
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
          className={`shrink-0 text-faint group-hover/side:text-blue transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Country dropdown */}
      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-30 bg-card border border-rule rounded-xl shadow-lg py-1.5 min-w-[140px]">
          {options.map((c) => {
            const active = c.iso === selected.iso;
            return (
              <button
                key={c.iso}
                type="button"
                onClick={() => selectCountry(c)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors ${
                  active ? "bg-paper" : "hover:bg-paper"
                }`}
              >
                <FlagIcon iso={c.iso} className="w-[18px] h-[13px] shrink-0" />
                <span className={`text-[13px] ${active ? "font-bold" : "font-semibold"} text-ink`}>
                  {c.country}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
