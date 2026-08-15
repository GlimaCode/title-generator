// ---------------------------------------------------------------------------
// Heuristic title parser for the CSV Account Title Converter.
//
// Given an existing eBay-style title, extract as much structured product info
// as possible (year, fitment, make, model, seat position/variation, material,
// color, product type, additional variation) into a ListingInput. The result
// is then fed through the SHARED generateForAccount() pipeline to rewrite it in
// the selected account's style — no separate/weaker logic.
//
// Matching is whole-word / whole-phrase (alphanumeric boundaries) and
// longest-first, so e.g. "tan" is NOT matched inside "Mustang" and "Driver
// Bottom" beats "Bottom Cover". When the make / model / position can't be
// found, the caller flags the row for review.
// ---------------------------------------------------------------------------

import type { FitmentWord, ListingInput, ProductWording } from "../types";
import { MAIN_VARIATIONS, CUSTOM_VARIATIONS } from "../config/variations";
import { CATALOG_FACTORY_COLORS, CATALOG_MATERIALS } from "./catalogLookup";

// --- Known vocabularies (extend freely) ------------------------------------

const MAKES = [
  "Mercedes-Benz", "Land Rover", "Alfa Romeo", "Chevrolet", "Chevy", "Ford", "Toyota", "Honda", "RAM",
  "Dodge", "GMC", "Nissan", "Jeep", "Hyundai", "Kia", "Subaru", "Mazda", "Volkswagen", "VW", "BMW",
  "Mercedes", "Audi", "Lexus", "Cadillac", "Buick", "Chrysler", "Tesla", "Acura", "Infiniti", "Lincoln",
  "Mitsubishi", "Volvo", "Porsche", "Fiat", "Mini", "Genesis", "Pontiac", "Saturn", "Hummer", "Scion",
];

const BASE_COLORS = [
  "Parchment Light Tan", "Parchment Lt Tan", "Parchment Tan", "Parchment",
  "Black", "Tan", "Beige", "Brown", "Charcoal", "Gray", "Grey", "Red", "Blue",
  "Green", "Ivory", "Cream", "White", "Saddle", "Camel", "Mocha", "Burgundy", "Maroon", "Silver", "Gold",
  "Orange", "Yellow", "Pink", "Purple", "Navy", "Khaki", "Wheat", "Graphite", "Slate", "Stone", "Cognac",
  "Oak", "Espresso",
];

// Color modifiers — captured together with the base color (e.g. "Medium Tan").
const COLOR_MODIFIERS = [
  "Medium", "Dark", "Light", "Bright", "Deep", "Pale", "Soft", "Warm", "Cool", "Natural", "Classic",
  "Neutral", "Metallic", "Matte", "Glossy",
];

// Spreadsheet factory colors first, then "Medium Tan"/"Dark Gray"-style combos,
// then plain colors — de-duplicated and longest-first so "Saddle Brown" wins
// over "Brown" and "Medium Parchment Tan" over "Parchment Tan".
const COLORS = dedupeByLowest([
  ...CATALOG_FACTORY_COLORS,
  ...COLOR_MODIFIERS.flatMap((m) => BASE_COLORS.map((c) => `${m} ${c}`)),
  ...BASE_COLORS,
]).sort((a, b) => b.length - a.length);

// Longest-first so "Genuine Leather" wins over "Leather", etc. Includes the
// spreadsheet's material list (de-duplicated case-insensitively). The legacy
// "Lthr."/"Lthr" forms are recognised only so they can be normalized back to
// the full protected word (see MATERIAL_CANONICAL) — they are never emitted.
const MATERIALS = dedupeByLowest([
  "Genuine Leather", "Synthetic Leather", "Genuine Lthr.", "Synthetic Lthr.", "Genuine Lthr",
  "Synthetic Lthr", "Leatherette", "MB-Tex",
  "Microfiber", "Neoprene", "Velour", "Leather", "Lthr.", "Lthr", "Vinyl", "Cloth", "Suede",
  ...CATALOG_MATERIALS,
]).sort((a, b) => b.length - a.length);

/**
 * Legacy material abbreviations -> the protected full word. Applied only to a
 * CONFIDENT material match (the token was matched against the material
 * vocabulary above), so "Lthr" inside any other field is never rewritten.
 * "Leatherette" is a DIFFERENT material and is never mapped to "Leather".
 */
const MATERIAL_CANONICAL: Record<string, string> = {
  "genuine lthr.": "Genuine Leather",
  "genuine lthr": "Genuine Leather",
  "synthetic lthr.": "Synthetic Leather",
  "synthetic lthr": "Synthetic Leather",
  "lthr.": "Leather",
  lthr: "Leather",
};

/** Normalize a matched material to its protected canonical spelling. */
function canonicalMaterial(found: string): string {
  return MATERIAL_CANONICAL[found.trim().toLowerCase()] ?? found;
}

const PRODUCTS = [
  "Replacement Seat Covers", "Replacement Seat Cover", "Upholstery Covers", "Upholstery Cover",
  "Replacement Covers", "Replacement Cover", "Repl. Seat Covers", "Repl. Seat Cover", "Repl. Covers",
  "Repl. Cover", "Bottom Covers", "Bottom Cover", "Top Covers", "Top Cover", "Seat Covers", "Seat Cover",
  "Covers", "Cover",
];

const ADDITIONAL = [
  "Perforated", "Perf.", "2-Tone", "Two-Tone", "Diamond Stitch", "Quilted", "w/ Piping", "w/o Piping",
  "With Piping", "Without Piping", "Insert",
];

// Base seat positions. The "&" combos are auto-expanded to "and" and "/" forms.
const BASE_POSITIONS = [
  "Driver & Passenger Top & Bottom", "Driver & Passenger Tops", "Driver & Passenger Bottoms",
  "Driver & Passenger Top", "Driver & Passenger Bottom", "Driver & Passenger", "Top & Bottom",
  "Front Bottom", "Front Top", "Rear Bottom", "Rear Top", "Driver Bottom", "Passenger Bottom",
  "Driver Top", "Passenger Top", "Lean Back", "Leanback", "Backrest", "Bench", "Headrest", "Armrest",
  "Front", "Rear", "Driver", "Passenger", "Top", "Bottom", "Lower",
];

/** Expand "X & Y" phrases to also include the "X and Y" and "X/Y" forms. */
function expandConnectors(phrases: string[]): string[] {
  const out = new Set<string>();
  for (const p of phrases) {
    out.add(p);
    if (p.includes(" & ")) {
      out.add(p.replace(/ & /g, " and "));
      out.add(p.replace(/ & /g, "/"));
    }
  }
  return [...out];
}

function dedupeByLowest(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const k = i.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(i);
    }
  }
  return out;
}

const POSITIONS = dedupeByLowest(
  expandConnectors([
    ...MAIN_VARIATIONS.map((v) => v.label),
    ...CUSTOM_VARIATIONS.map((v) => v.label),
    ...BASE_POSITIONS,
  ]),
).sort((a, b) => b.length - a.length);

// --- Extraction helpers -----------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word/phrase match (no letters/digits immediately adjacent). */
function boundedRegex(phrase: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])${escapeRegex(phrase)}(?![A-Za-z0-9])`, "i");
}

/**
 * Remove the first matching candidate. Returns the CANONICAL candidate form
 * (normalizes casing, e.g. "GENUINE LEATHER" -> "Genuine Leather") while
 * removing the original matched span from the text.
 */
function extractFirst(text: string, candidates: string[]): { found: string; rest: string } {
  for (const c of candidates) {
    const m = boundedRegex(c).exec(text);
    if (m) {
      const rest = (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
      return { found: c, rest };
    }
  }
  return { found: "", rest: text };
}

/** Remove the LEFTMOST-occurring candidate (ties broken by longer match); returns canonical form. */
function extractLeftmost(text: string, candidates: string[]): { found: string; rest: string } {
  let best: { index: number; length: number; canonical: string } | null = null;
  for (const c of candidates) {
    const m = boundedRegex(c).exec(text);
    if (m && (!best || m.index < best.index || (m.index === best.index && m[0].length > best.length))) {
      best = { index: m.index, length: m[0].length, canonical: c };
    }
  }
  if (!best) return { found: "", rest: text };
  const rest = (text.slice(0, best.index) + " " + text.slice(best.index + best.length)).replace(/\s+/g, " ").trim();
  return { found: best.canonical, rest };
}

/** Light casing normalization for the model: Title-case long ALL-CAPS alpha words
 *  (e.g. "SILVERADO" -> "Silverado") while keeping codes/short tokens (F-150, LTZ, RAM). */
function normalizeModelCase(model: string): string {
  return model
    .split(" ")
    .map((w) => (/^[A-Z]{4,}$/.test(w) ? w[0] + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Extract a year range / year token (full, mixed, or short forms). */
function extractYear(text: string): { found: string; rest: string } {
  const m = text.match(/\b\d{4}\s*[-–]\s*\d{4}\b|\b\d{4}\s*[-–]\s*\d{2}\b|\b\d{2}\s*[-–]\s*\d{2}\b|\b(?:19|20)\d{2}\b/);
  if (!m) return { found: "", rest: text };
  const found = m[0].replace(/\s*[-–]\s*/, "-");
  const rest = (text.slice(0, m.index) + " " + text.slice((m.index ?? 0) + m[0].length)).replace(/\s+/g, " ").trim();
  return { found, rest };
}

function extractFitment(text: string): { found: FitmentWord | ""; rest: string } {
  const m = text.match(/\b(Fits|For)\b/i);
  if (!m) return { found: "", rest: text };
  const found = (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) as FitmentWord;
  const rest = (text.slice(0, m.index) + " " + text.slice((m.index ?? 0) + m[0].length)).replace(/\s+/g, " ").trim();
  return { found, rest };
}

function toProductWording(s: string): ProductWording {
  const l = s.toLowerCase();
  if (l.includes("upholstery")) return "Upholstery Cover";
  if (l.includes("replacement") || l.includes("repl.")) return "Replacement Cover";
  if (l.includes("bottom cover")) return "Bottom Cover";
  if (l.includes("top cover")) return "Top Cover";
  if (l === "cover" || l === "covers") return "Cover";
  return "Seat Cover";
}

export interface ParseResult {
  listing: ListingInput;
  /** Critical fields that could not be parsed (make / model / position). */
  missing: string[];
}

/** Parse a free-form title into a best-effort ListingInput. */
export function parseTitle(title: string): ParseResult {
  let rest = (title || "").replace(/\s+/g, " ").trim();

  const year = extractYear(rest);
  rest = year.rest;
  const fit = extractFitment(rest);
  rest = fit.rest;
  const material = extractFirst(rest, MATERIALS);
  rest = material.rest;
  const additional = extractFirst(rest, ADDITIONAL);
  rest = additional.rest;
  const position = extractFirst(rest, POSITIONS); // longest-first, before product
  rest = position.rest;
  const product = extractFirst(rest, PRODUCTS);
  rest = product.rest;
  const color = extractFirst(rest, COLORS);
  rest = color.rest;
  const make = extractLeftmost(rest, MAKES); // leftmost so "Dodge RAM" keeps Dodge as make
  rest = make.rest;

  // Whatever remains is treated as the model (light casing normalization).
  const model = normalizeModelCase(rest.trim());

  const missing: string[] = [];
  if (!make.found) missing.push("make");
  if (!model) missing.push("model");
  if (!position.found) missing.push("position");

  const listing: ListingInput = {
    yearRange: year.found,
    make: make.found,
    model,
    position: position.found,
    material: canonicalMaterial(material.found), // legacy "Lthr." -> "Leather"
    variation: additional.found,
    color: color.found,
    fitment: fit.found || "Fits",
    productType: product.found ? toProductWording(product.found) : "Seat Cover",
  };

  return { listing, missing };
}
