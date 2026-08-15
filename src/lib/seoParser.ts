// ---------------------------------------------------------------------------
// SEO parser — turns a seat-cover title into structured info for SEO content.
// Reuses the shared parseTitle(), then expands years, detects chassis/series,
// and expands abbreviations (Perf/Prf -> perforated, Dk -> dark, Lthr. ->
// leather, etc.) so the SEO output reads in full natural language.
// ---------------------------------------------------------------------------

import { parseTitle } from "./titleParser";

export interface SeoInfo {
  title: string;
  yearRange: string;
  years: string[];
  make: string;
  model: string;
  chassis: string; // e.g. W222, R230, GX470 ("" if none)
  material: string;
  materialLower: string;
  isLeather: boolean;
  perforated: boolean;
  color: string;
  colorLower: string;
  position: string;
  positionLower: string;
  productType: string;
  variation: string;
  descr: {
    driver: boolean;
    passenger: boolean;
    front: boolean;
    rear: boolean;
    top: boolean;
    bottom: boolean;
    side: boolean;
    backrest: boolean;
  };
}

/** Expand SEO abbreviations to full words and strip decorative symbols. */
function expandAbbrev(title: string): string {
  return (title || "")
    .replace(/\bGenuine Lthr\.?\b/gi, "Genuine Leather")
    .replace(/\bLthr\.?\b/gi, "Leather")
    .replace(/\b(?:Prf|Perf)\.?(?=\s|$)/gi, "Perforated")
    .replace(/\bDk\b/gi, "Dark")
    .replace(/\bLt\b/gi, "Light")
    .replace(/\bMed\b/gi, "Medium")
    .replace(/\bChar\b/gi, "Charcoal")
    .replace(/\bDp\b/gi, "Deep")
    .replace(/\bPl\b/gi, "Pale")
    .replace(/\bSft\b/gi, "Soft")
    .replace(/\bWrm\b/gi, "Warm")
    .replace(/\bCl\b/gi, "Cool")
    .replace(/\bNat\b/gi, "Natural")
    .replace(/\bClsc\b/gi, "Classic")
    .replace(/\bNeut\b/gi, "Neutral")
    .replace(/\bMet\b/gi, "Metallic")
    .replace(/\bMt\b/gi, "Matte")
    .replace(/\bGlsy\b/gi, "Glossy")
    .replace(/\bBrt\b/gi, "Bright")
    .replace(/[+"'“”‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Expand a year range into individual years (handles 2- and 4-digit forms). */
export function expandYears(yearRange: string): string[] {
  const m = yearRange.trim().match(/^(\d{2,4})\s*-\s*(\d{2,4})$/);
  if (m) {
    let start = parseInt(m[1], 10);
    let end = parseInt(m[2], 10);
    if (m[1].length === 2) start += start < 50 ? 2000 : 1900;
    if (m[2].length === 2) {
      const base = Math.floor(start / 100) * 100;
      end = base + (end % 100);
      if (end < start) end += 100;
    }
    if (end >= start && end - start <= 40) {
      const out: string[] = [];
      for (let y = start; y <= end; y++) out.push(String(y));
      return out;
    }
  }
  const single = yearRange.match(/\b(?:19|20)\d{2}\b/);
  return single ? [single[0]] : [];
}

// Seat-position / product words that may leak into the model leftover — these
// belong to the position, not the make/model, so they're stripped for SEO.
const MODEL_STRIP = new Set([
  "front", "rear", "driver", "passenger", "top", "bottom", "lower", "side", "bench", "headrest",
  "armrest", "backrest", "back", "left", "right", "cover", "covers", "seat", "perforated", "perf",
]);

/** Remove position/product descriptor words and stray punctuation from a model. */
function cleanModelTokens(model: string): string {
  return model
    .split(" ")
    .filter((w) => w && !MODEL_STRIP.has(w.toLowerCase()) && !/^[.,;:]+$/.test(w))
    .join(" ")
    .trim();
}

/** Find a chassis/series code (W222, R230, GX470, …) in the model/title. */
function detectChassis(model: string, title: string): { chassis: string; cleanModel: string } {
  const words = model.split(" ");
  for (let i = 0; i < words.length; i++) {
    if (/^[A-Z]{1,3}\d{2,4}$/.test(words[i])) {
      const chassis = words[i];
      words.splice(i, 1);
      return { chassis, cleanModel: words.join(" ").trim() };
    }
  }
  const m = title.match(/\b[A-Z]{1,3}\d{2,4}\b/);
  return { chassis: m ? m[0] : "", cleanModel: model };
}

export function parseForSeo(title: string): SeoInfo {
  const expanded = expandAbbrev(title);
  const listing = parseTitle(expanded).listing;

  const { chassis, cleanModel } = detectChassis(listing.model, expanded);
  const model = cleanModelTokens(cleanModel);
  const years = expandYears(listing.yearRange);

  const lc = expanded.toLowerCase();
  const has = (re: RegExp) => re.test(lc);
  const material = listing.material;
  const perforated = /\bperforated\b/i.test(expanded) || /perf/i.test(listing.variation);

  return {
    title,
    yearRange: listing.yearRange,
    years,
    make: listing.make,
    model,
    chassis,
    material,
    materialLower: material.toLowerCase(),
    isLeather: /leather/i.test(material) && !/leatherette/i.test(material),
    perforated,
    color: listing.color,
    colorLower: listing.color.toLowerCase(),
    position: listing.position,
    positionLower: listing.position.toLowerCase(),
    productType: listing.productType,
    variation: listing.variation,
    descr: {
      driver: has(/\bdriver\b/),
      passenger: has(/\bpassenger\b/),
      front: has(/\bfront\b/),
      rear: has(/\brear\b/),
      top: has(/\btop\b/),
      bottom: has(/\b(?:bottom|lower)\b/),
      side: has(/\bside\b/),
      backrest: has(/\bbackrest\b/),
    },
  };
}
