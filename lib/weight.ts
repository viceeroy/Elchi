// Wire format for a post's `weight` field, shared by the composer (which
// writes it), the traveler/request card and App.tsx (which both read it
// back). A traveler row is "<kg> kg", "<n> chamadon", or both joined with
// " + "; a request row appends "· <categories>", which this module leaves
// untouched since only the kg/chamadon amounts are ever parsed back out.
//
// "chamadon" is stored as the neutral (unpluralized) token — callers decide
// how to render "1 chamadon" vs "5 ta chamadon" for display.

const KG_RE = /(\d+)\s*kg/i;
const CHAMADON_RE = /(\d+)\s*chamadon\b/i;
const CHAMADON_RE_GLOBAL = /(\d+)\s*chamadon\b/gi;

export function buildWeightString(kg: number, luggage: number): string {
  const parts: string[] = [];
  if (kg > 0) parts.push(`${kg} kg`);
  if (luggage > 0) parts.push(`${luggage} chamadon`);
  return parts.join(" + ") || "0 kg";
}

export interface ParsedWeight {
  kg: number | null;
  luggage: number | null;
}

export function parseWeightString(weight: string | null | undefined): ParsedWeight {
  if (!weight) return { kg: null, luggage: null };
  const kgMatch = weight.match(KG_RE);
  const luggageMatch = weight.match(CHAMADON_RE);
  return {
    kg: kgMatch ? parseInt(kgMatch[1], 10) : null,
    luggage: luggageMatch ? parseInt(luggageMatch[1], 10) : null,
  };
}

// Replaces every neutral "<n> chamadon" token in a weight string with its
// pluralized form, leaving the kg amount and any category text untouched.
export function replaceLuggageToken(
  weight: string,
  pluralize: (n: number) => string,
): string {
  return weight.replace(CHAMADON_RE_GLOBAL, (_match, numStr: string) => {
    const n = parseInt(numStr, 10);
    return `${n} ${pluralize(n)}`;
  });
}
