// ---------------------------------------------------------------------------
// Catalog lookups (suggestion datasets + factory-color -> visual-color logic).
//
// Built once from the generated spreadsheet catalog (src/data/catalog.ts) and
// memoized, so autocomplete filtering and the title pipeline stay fast.
// ---------------------------------------------------------------------------

import { CATALOG } from "../data/catalog";

/** Canonical main visual color vocabulary (safe fallback detection). */
export const VISUAL_COLOR_WORDS = [
  "Black", "Brown", "Beige", "Tan", "Gray", "Grey", "Red", "Blue", "Green",
  "White", "Silver", "Gold", "Burgundy", "Maroon", "Purple",
];

const VISUAL_BY_LOWER = new Map(VISUAL_COLOR_WORDS.map((w) => [w.toLowerCase(), w]));

/** All make display names, alphabetical. */
export const CATALOG_MAKES: string[] = CATALOG.makes.map((m) => m.make);

/** Lookup key: case-insensitive, hyphen treated as space, spaces collapsed —
 *  so a manually typed "Mercedes Benz" still resolves "Mercedes-Benz" models. */
function makeKey(make: string): string {
  return make.toLowerCase().replace(/[-\s]+/g, " ").trim();
}

const MODELS_BY_MAKE = new Map(CATALOG.makes.map((m) => [makeKey(m.make), m.models]));

/** Models belonging to a make (tolerant match); empty when the make is unknown. */
export function modelsForMake(make: string): string[] {
  return MODELS_BY_MAKE.get(makeKey(make)) ?? [];
}

/** True when the make exists in the catalog. */
export function isKnownMake(make: string): boolean {
  return MODELS_BY_MAKE.has(makeKey(make));
}

/** True when the model belongs to the given make (case-insensitive). */
export function modelBelongsToMake(make: string, model: string): boolean {
  const wanted = model.trim().toLowerCase();
  return modelsForMake(make).some((m) => m.toLowerCase() === wanted);
}

export const CATALOG_MATERIALS: string[] = CATALOG.materials;

export const CATALOG_FACTORY_COLORS: string[] = CATALOG.colors.map((c) => c.factoryColor);

export const CATALOG_VARIATIONS: string[] = CATALOG.variations;

const VISUAL_BY_FACTORY = new Map(
  CATALOG.colors.map((c) => [c.factoryColor.toLowerCase(), c.visualColor]),
);

function lastVisualWordIn(text: string): string {
  const words = text.match(/[A-Za-z][A-Za-z-]*/g) ?? [];
  for (let i = words.length - 1; i >= 0; i--) {
    const hit = VISUAL_BY_LOWER.get(words[i].toLowerCase());
    if (hit) return hit;
  }
  return "";
}

/**
 * The PROTECTED main visual color for a color string. Spreadsheet mapping is
 * the source of truth (ColorFactory sheet); when the color isn't in the
 * catalog, fall back to the rightmost known visual-color word in the string.
 * Returns "" when no visual word is present — such a color is never reduced
 * (removal-based shortening can't produce a word that isn't there).
 */
export function visualColorFor(color: string): string {
  const c = color.trim();
  if (!c) return "";
  const mapped = VISUAL_BY_FACTORY.get(c.toLowerCase());
  if (mapped !== undefined && mapped !== "") return mapped;
  return lastVisualWordIn(c);
}
