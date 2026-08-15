// ---------------------------------------------------------------------------
// Seat Cover Title Batch Generator — rule-based engine (no external APIs, no AI).
//
// Generates ONE eBay-style title per active account. Each account has its own
// title structure / fitment word / product wording, so titles look different
// while preserving identical product meaning. Titles are kept within the
// 80-character limit using only the approved abbreviation rules.
// ---------------------------------------------------------------------------

import type {
  AccountConfig,
  FitmentWord,
  GeneratedTitle,
  ListingInput,
  RiskFlag,
  Status,
  TitleToken,
} from "./types";
import { visualColorFor } from "./lib/catalogLookup";

export const MAX_LENGTH = 80;

/** Required listing fields (Fitment/Product Type have defaults; Variation is optional). */
export const REQUIRED_LISTING_FIELDS: { key: keyof ListingInput; label: string }[] = [
  { key: "yearRange", label: "Year Range" },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "position", label: "Seat Position" },
  { key: "material", label: "Material" },
  { key: "color", label: "Color" },
];

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function getStatus(length: number): Status {
  if (length > MAX_LENGTH) return "Too Long";
  if (length >= 76) return "Near Limit";
  if (length >= 71) return "Safe";
  return "Good";
}

// ---------------------------------------------------------------------------
// String building
// ---------------------------------------------------------------------------

/** Join title parts with single spaces, dropping empties and collapsing gaps. */
function build(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Abbreviation rules
//
// PROTECTED — never produced (simply never listed as a replacement):
//   Genuine -> Gen.            (forbidden)
//   Driver  -> Drvr            (forbidden)
//   Passenger -> Pass/Pass./Psgr (forbidden)
//   Bottom  -> Btm             (forbidden)
//   Leather -> Lthr./Lthr/Leath. (forbidden — see MATERIAL PROTECTION below)
//   Leatherette -> any short form (forbidden)
//   Leatherette/Vinyl/Cloth/Suede/MB-Tex are never turned into "Leather".
//
// MATERIAL PROTECTION: "Leather" and "Leatherette" are protected material words.
// They are ALWAYS written in full and are never abbreviated or removed by any
// generation path (matrix, phrase stages, custom variations, CSV converter, and
// cross-account uniqueness regeneration all share these rule sets). An over-80
// title carrying the correct material is preferred over a shorter one that
// abbreviates it — such titles are surfaced as Too Long / CHECK instead.
// Legacy "Lthr."/"Lthr" arriving from an imported CSV is normalized back to
// "Leather" by the parser, so it never survives into a generated title.
//
// Abbreviations are applied ONLY when a title is over the limit, progressively
// (least-disruptive first), so meaning is preserved as long as possible.
//
// Word-boundary note: /\bLeather\b/ does NOT match "Leatherette" (the following
// "e" is a word char, so there is no boundary), so Leatherette is left intact.
// ---------------------------------------------------------------------------

interface Rule {
  re: RegExp;
  to: string;
  /** Optional human-readable note recorded when this rule actually fires. */
  note?: string;
}

// Parchment color fallback (Rule A): when a color contains BOTH "Parchment" and
// "Tan" (e.g. "Medium Parchment Tan"), drop "Parchment" first and keep "Tan".
// Only fires when the title is over the limit; never removes "Tan". Color-only —
// it requires "Parchment" be immediately followed by "Tan" (never a model/trim).
const PARCHMENT_TAN_RULE: Rule = { re: /\bParchment\s+(?=Tan\b)/gi, to: "", note: "Parchment removed, Tan kept" };

// Parchment/Light/Tan ordered fallback. For a color like "Parchment Light Tan",
// "Tan" is the main VISUAL color and is NEVER removed. Reduction order (each
// step only fires if the title is still over the limit):
//   "Parchment Light Tan" -> "Parchment Lt Tan" -> "Parchment Tan" -> "Tan"
// (the last step is the existing PARCHMENT_TAN_RULE). Both rules are anchored
// on the full "Parchment … Tan" sequence, so they can only ever match the color
// token — never "Light"/"Lt" in a make, model, trim, or chassis name.
const PARCHMENT_LIGHT_LT_RULE: Rule = {
  re: /\b(Parchment)\s+Light(?=\s+Tan\b)/gi,
  to: "$1 Lt",
  note: "Light shortened to Lt",
};
const PARCHMENT_LT_REMOVED_RULE: Rule = {
  re: /\b(Parchment)\s+Lt\s+(?=Tan\b)/gi,
  to: "$1 ",
  note: "Light modifier removed, Tan kept",
};

// Replacement fallback (shared by the full and phrase-mode sets so the Variation
// Matrix and the CSV converter behave identically):
//   "Replacement Seat Cover" -> "Repl. Seat Cover" -> "Seat Cover"
// Each step fires only while the title is still over the limit. Removal takes
// the trailing space with it and applyRule() re-collapses whitespace, so no
// double spaces or stray punctuation are left behind. The product wording that
// follows is never touched, so the product meaning survives removal.
const REPLACEMENT_SHORT_RULE: Rule = {
  re: /\bReplacement\b/g,
  to: "Repl.",
  note: "Replacement shortened to Repl.",
};
const REPLACEMENT_REMOVE_RULE: Rule = {
  re: /\bRepl\.\s*/g,
  to: "",
  note: "Replacement removed to meet character limit",
};

// Approved color modifier abbreviations (the ONLY approved list — no new ones).
const COLOR_MODIFIER_PAIRS: [string, string][] = [
  ["Medium", "Med"], ["Charcoal", "Char"], ["Metallic", "Met"], ["Natural", "Nat"],
  ["Classic", "Clsc"], ["Neutral", "Neut"], ["Glossy", "Glsy"], ["Bright", "Brt"],
  ["Matte", "Mt"], ["Dark", "Dk"], ["Light", "Lt"], ["Deep", "Dp"], ["Pale", "Pl"],
  ["Soft", "Sft"], ["Warm", "Wrm"], ["Cool", "Cl"],
];
const MODIFIER_ABBREV = new Map(COLOR_MODIFIER_PAIRS.map(([f, t]) => [f.toLowerCase(), t]));
const MODIFIER_SHORT_FORMS = new Set(COLOR_MODIFIER_PAIRS.map(([, t]) => t.toLowerCase()));

// Color modifier abbreviations — shared by both the full and phrase-mode sets,
// so every section abbreviates colors the same way (only fire when over limit).
const COLOR_MODIFIER_RULES: Rule[] = COLOR_MODIFIER_PAIRS.map(([from, to]) => ({
  re: new RegExp(`\\b${from}\\b`, "gi"),
  to,
  note: "Color shortened",
}));

const ABBREVIATIONS: Rule[] = [
  // Cosmetic / safe joiners first. "and" is case-insensitive so it also covers
  // "Top and Bottom" -> "Top & Bottom" and "Driver and Passenger" -> "Driver &
  // Passenger" (\band\b never matches inside words like "Grand" or "Brandon").
  { re: /\bWithout\b/g, to: "w/o" },
  { re: /\bWith\b/g, to: "w/" },
  { re: /\band\b/gi, to: "&" },
  { re: /\bPerforated\b/g, to: "Perf." },
  { re: /\bLean Back\b/g, to: "Leanback" },
  { re: /\bBackrest\b/g, to: "Back" },
  // "Only if necessary" abbreviations, applied later (meaning kept clear).
  { re: /\bSecond Row\b/gi, to: "2nd Row" },
  { re: /\bCenter Console\b/gi, to: "Console" },
  // Slash shortening — keeps the full words Driver / Passenger / Top / Bottom
  // (applied after "and -> &", so it converts the "&" form to the slash form).
  { re: /Driver & Passenger/g, to: "Driver/Passenger", note: "Used slash format" },
  { re: /Top & Bottom/g, to: "Top/Bottom", note: "Used slash format" },
  // Replacement fallback: shorten first, then (only if STILL over the limit)
  // drop the word entirely. The product wording that follows ("Seat Cover",
  // "Cover", "Covers", …) always remains, so the product meaning is kept.
  REPLACEMENT_SHORT_RULE,
  REPLACEMENT_REMOVE_RULE,
  // NOTE: "Leather"/"Leatherette" are protected — no material abbreviation here.
  // Color fallback + modifier abbreviations (only fire when still over the limit).
  // Parchment/Light/Tan order: Light->Lt, then drop Lt, then drop Parchment —
  // "Tan" always survives.
  PARCHMENT_LIGHT_LT_RULE,
  PARCHMENT_LT_REMOVED_RULE,
  PARCHMENT_TAN_RULE,
  ...COLOR_MODIFIER_RULES,
  { re: /\bBottom\b/g, to: "Lower", note: "Bottom changed to Lower" },
];

// Phrase-stage mode: the variation phrase itself encodes the seat component +
// product wording AND its reductions (and -> & -> / forms, Replacement/Seat/
// Cover steps, Side/Front fallbacks). So in phrase mode we DON'T abbreviate
// those phrase words — only material/variation words — letting the explicit,
// clean phrase progression do the component/product reducing.
const PHRASE_ABBREVIATIONS: Rule[] = [
  { re: /\bWithout\b/g, to: "w/o" },
  { re: /\bWith\b/g, to: "w/" },
  { re: /\bPerforated\b/g, to: "Perf." },
  // Additional-variation abbreviations. These words never appear in the main
  // variation phrases (which are seat components + product), so applying them
  // here only shortens the user's Additional Variation token — the phrase's own
  // component/product reduction still comes from its ordered phrase stages.
  { re: /\bSecond Row\b/gi, to: "2nd Row" },
  { re: /\bCenter Console\b/gi, to: "Console" },
  // Replacement may be SHORTENED here; its removal is left to the phrase ladder,
  // whose ordered stages already drop "Replacement" in the designed priority
  // (… Replacement Seat Covers -> … Replacement Covers -> … Seat Covers -> …).
  REPLACEMENT_SHORT_RULE,
  // NOTE: "Leather"/"Leatherette" are protected — no material abbreviation here.
  // Color fallback + modifiers are shared (they affect the color token, not the phrase).
  // Same Parchment/Light/Tan order as the full set — "Tan" always survives.
  PARCHMENT_LIGHT_LT_RULE,
  PARCHMENT_LT_REMOVED_RULE,
  PARCHMENT_TAN_RULE,
  ...COLOR_MODIFIER_RULES,
];

// ---------------------------------------------------------------------------
// Visual-color-protected reduction (ColorFactory-driven).
//
// The listing's color may be a multi-word factory color ("Saddle Brown",
// "Medium Parchment Tan", "Light Titanium Gray"). The MAIN VISUAL color
// (resolved from the spreadsheet's ColorFactory mapping first, then from the
// known visual-color vocabulary) must survive shortening. When the title is
// over the limit, the color is reduced ONE WORD AT A TIME, re-checking the
// length after every step (fitToLimit stops as soon as the title fits):
//   1. abbreviate approved modifiers ("Light" -> "Lt", "Dark" -> "Dk", …)
//   2. remove the abbreviated modifiers one at a time
//   3. remove remaining factory descriptors ("Saddle", "Titanium", …) one at
//      a time — the visual color word is NEVER removed.
// A color with no in-name visual word (e.g. "Ebony") is never reduced here.
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-phrase regex for one exact color form (never matches inside words). */
function phraseRegex(phrase: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])${escapeRegex(phrase)}(?![A-Za-z0-9])`, "g");
}

/**
 * Build the ordered reduction rules for ONE specific color string. Each rule
 * rewrites the color's current form into its next (one-word-smaller) form, so
 * only the exact color phrase in the title is ever touched — "Light"/"Dark"/
 * "Saddle" in a make, model, trim, or chassis name can never match.
 */
export function buildColorReductionRules(color: string, visualColor: string): Rule[] {
  const visual = visualColor.trim();
  const words = color.trim().split(/\s+/);
  if (!visual || words.length <= 1) return [];
  // The visual color word must actually be present (rightmost occurrence wins).
  const visualIdx = words.map((w) => w.toLowerCase()).lastIndexOf(visual.toLowerCase());
  if (visualIdx < 0) return [];

  const rules: Rule[] = [];
  let current = [...words];
  const step = (next: string[], note: string) => {
    rules.push({ re: phraseRegex(current.join(" ")), to: next.join(" "), note });
    current = next;
  };

  // 1. Abbreviate approved modifiers, one word per step (left to right).
  for (let i = 0; i < current.length; i++) {
    if (i === visualIdx) continue;
    const abbrev = MODIFIER_ABBREV.get(current[i].toLowerCase());
    if (abbrev && abbrev.toLowerCase() !== current[i].toLowerCase()) {
      const next = [...current];
      const from = next[i];
      next[i] = abbrev;
      step(next, `${from} shortened to ${abbrev}`);
    }
  }
  // 2. Remove modifier words (now in short form), one per step.
  for (let i = current.length - 1; i >= 0; i--) {
    if (current[i].toLowerCase() === visual.toLowerCase()) continue;
    if (MODIFIER_SHORT_FORMS.has(current[i].toLowerCase())) {
      step(current.filter((_, j) => j !== i), `Color modifier removed; ${visual} preserved`);
    }
  }
  // 3. Remove remaining factory descriptors, one per step — never the visual word.
  for (let i = current.length - 1; i >= 0; i--) {
    if (current[i].toLowerCase() === visual.toLowerCase()) continue;
    const word = current[i];
    const note = /^parchment$/i.test(word)
      ? `Parchment removed; ${visual} preserved`
      : `Factory color descriptor removed; ${visual} preserved`;
    step(current.filter((_, j) => j !== i), note);
  }
  return rules;
}

/**
 * Compose a rule set with the dynamic color-reduction chain for this listing's
 * color inserted at the start of the color block (before the static parchment
 * fallback), so the ColorFactory-aware reduction takes priority everywhere the
 * shared pipeline runs (Matrix main/custom, CSV converter, batch).
 */
function withColorReduction(base: Rule[], color: string, visualColor: string): Rule[] {
  const dynamic = buildColorReductionRules(color, visualColor);
  if (dynamic.length === 0) return base;
  const at = base.indexOf(PARCHMENT_LIGHT_LT_RULE);
  const idx = at >= 0 ? at : base.length;
  return [...base.slice(0, idx), ...dynamic, ...base.slice(idx)];
}

function applyRule(text: string, rule: Rule): string {
  return text.replace(rule.re, rule.to).replace(/\s+/g, " ").trim();
}

/**
 * Progressively shorten a title until it fits within MAX_LENGTH, applying the
 * approved abbreviations in priority order and stopping as soon as it fits.
 * Returns whether any abbreviation had to be applied.
 */
function fitToLimit(
  text: string,
  rules: Rule[] = ABBREVIATIONS,
): { title: string; abbreviated: boolean; notes: string[] } {
  let out = text;
  let abbreviated = false;
  const notes = new Set<string>();
  for (const rule of rules) {
    if (out.length <= MAX_LENGTH) break;
    const next = applyRule(out, rule);
    if (next !== out) {
      abbreviated = true;
      if (rule.note) notes.add(rule.note);
    }
    out = next;
  }
  return { title: out, abbreviated, notes: [...notes] };
}

// ---------------------------------------------------------------------------
// Token resolution
// ---------------------------------------------------------------------------

interface TitleValues {
  fit: FitmentWord;
  year: string;
  product: string;
}

/**
 * Resolve the title tokens for an account using the supplied dynamic values
 * (fitment word, year range, product wording). Everything else is the listing
 * value, preserved exactly. The variation token only renders when the account
 * opts in AND a variation value exists.
 */
/**
 * Ensure the account's title structure carries a "variation" slot whenever the
 * user entered an Additional Variation. Accounts that don't normally weave the
 * variation in still get it appended (right after the seat position, else before
 * the product wording, else at the end) so the Additional Variation is NEVER
 * dropped just because of an account's default layout. When there is no
 * variation value, the structure is returned unchanged.
 */
export function ensureVariationToken(structure: TitleToken[], listing: ListingInput): TitleToken[] {
  if (!listing.variation.trim() || structure.includes("variation")) return structure;
  const s = [...structure];
  const posIdx = s.indexOf("position");
  if (posIdx >= 0) s.splice(posIdx + 1, 0, "variation");
  else {
    const prodIdx = s.indexOf("productType");
    if (prodIdx >= 0) s.splice(prodIdx, 0, "variation");
    else s.push("variation");
  }
  return s;
}

function resolveTokens(listing: ListingInput, account: AccountConfig, v: TitleValues): string[] {
  return account.titleStructure.map((token: TitleToken) => {
    switch (token) {
      case "year":
        return v.year;
      case "fitment":
        return v.fit;
      case "make":
        return listing.make;
      case "model":
        return listing.model;
      case "position":
        return listing.position;
      case "material":
        return listing.material;
      case "variation":
        // Additional Variation is preserved for EVERY account whenever the user
        // entered one (never gated away). ensureVariationToken() guarantees this
        // token is present in the effective structure when a variation exists.
        return listing.variation.trim().length > 0 ? listing.variation : "";
      case "productType":
        return v.product;
      case "color":
        return listing.color;
    }
  });
}

/**
 * Controlled year-range shortening. For a clean "YYYY-YYYY" range we expose two
 * stages: shorten only the ending year first ("2000-2010" -> "2000-10"), then
 * shorten both ("2000-2010" -> "00-10"). Non-standard formats are left intact.
 */
function yearStages(year: string): { end?: string; full?: string } {
  const m = year.trim().match(/^(\d{4})-(\d{4})$/);
  if (!m) return {};
  const start = m[1];
  const end = m[2];
  return { end: `${start}-${end.slice(2)}`, full: `${start.slice(2)}-${end.slice(2)}` };
}

// ---------------------------------------------------------------------------
// Generation
//
// Shortening priority when a title exceeds 80 chars (see project spec):
//   1-2. Approved abbreviations (incl. variation wording) — via fitToLimit.
//   3.   Dynamic fitment fallback: "Fits" -> "For" (shorter), only if needed.
//   4.   Shorten the year ENDING ("2000-2010" -> "2000-10").
//   5.   Shorten the year FULLY  ("2000-10"  -> "00-10").
//   6.   Shorter product wording -> "Cover" (meaning preserved), last resort.
//   7.   Still too long -> Too Long / CHECK / "Needs manual shortening".
// Protected words (Genuine/Driver/Passenger/Bottom) are never unsafely changed.
// ---------------------------------------------------------------------------

interface PipelineResult {
  title: string;
  fit: FitmentWord;
  year: string;
  abbreviated: boolean;
  fitmentChanged: boolean;
  yearChanged: boolean;
  productChanged: boolean;
  abbrevNotes: string[]; // specific notes from rules that fired (slash, Lower, …)
}

/**
 * Core shortening pipeline for ONE rendered title (a fixed position/product).
 * Applies, only as needed: approved abbreviations -> Fits→For -> year ending ->
 * year full -> (optional) generic product wording -> Cover. Fitment and year
 * changes are applied cumulatively (so earlier abbreviations are preserved).
 */
function runPipeline(
  listing: ListingInput,
  account: AccountConfig,
  baseFit: FitmentWord,
  baseProduct: string,
  productFallback: boolean,
  abbrevRules: Rule[] = ABBREVIATIONS,
): PipelineResult {
  const fullYear = listing.yearRange;
  const stages = yearStages(fullYear);

  let fit = baseFit;
  let year = fullYear;
  let product = baseProduct;

  // 1-2. Approved abbreviations.
  const noteSet = new Set<string>();
  const firstPass = fitToLimit(build(resolveTokens(listing, account, { fit, year, product })), abbrevRules);
  let title = firstPass.title;
  firstPass.notes.forEach((n) => noteSet.add(n));

  // 3. Dynamic fitment fallback — "For" is shorter than "Fits".
  let fitmentChanged = false;
  if (title.length > MAX_LENGTH && fit === "Fits") {
    title = title.replace(/\bFits\b/g, "For");
    fit = "For";
    fitmentChanged = true;
  }

  // 4-5. Shorten the year ending, then fully.
  if (title.length > MAX_LENGTH && stages.end) {
    title = title.replace(year, stages.end);
    year = stages.end;
  }
  if (title.length > MAX_LENGTH && stages.full) {
    title = title.replace(year, stages.full);
    year = stages.full;
  }

  // 6. Generic shorter product wording (only when phrase stages aren't driving it).
  let productChanged = false;
  if (productFallback && title.length > MAX_LENGTH && product !== "Cover") {
    const pf = fitToLimit(build(resolveTokens(listing, account, { fit, year, product: "Cover" })), abbrevRules);
    title = pf.title;
    pf.notes.forEach((n) => noteSet.add(n));
    product = "Cover";
    productChanged = true;
  }

  // Detect remaining abbreviations by comparing against the un-abbreviated build
  // with the final dynamic values (so only abbreviation differences show up).
  const fullNoAbbrev = build(resolveTokens(listing, account, { fit, year, product }));
  return {
    title,
    fit,
    year,
    abbreviated: title !== fullNoAbbrev,
    fitmentChanged,
    yearChanged: year !== fullYear,
    productChanged,
    abbrevNotes: [...noteSet],
  };
}

/**
 * Color normalization (Rule B): a color that contains "Parchment" but NOT "Tan"
 * is treated as "Tan" for our seat-cover workflow. Color-only, unconditional.
 * Returns the normalized color and a note if it changed.
 */
export function normalizeColorForTitle(color: string): { color: string; note: string | null } {
  if (/\bParchment\b/i.test(color) && !/\bTan\b/i.test(color)) {
    return { color: color.replace(/\bParchment\b/gi, "Tan").replace(/\s+/g, " ").trim(), note: "Parchment converted to Tan" };
  }
  return { color, note: null };
}

/** Generate the single title an account produces for a listing. */
export function generateForAccount(listing: ListingInput, account: AccountConfig): GeneratedTitle {
  const baseFit: FitmentWord = account.preferredFitmentWord || listing.fitment;
  const baseProduct: string = account.preferredProductWording || listing.productType;
  const colorNorm = normalizeColorForTitle(listing.color);
  const wl: ListingInput = { ...listing, color: colorNorm.color };
  // Guarantee the Additional Variation slot exists for this account when needed.
  const eaccount: AccountConfig = { ...account, titleStructure: ensureVariationToken(account.titleStructure, wl) };
  const r = runPipeline(
    wl,
    eaccount,
    baseFit,
    baseProduct,
    true,
    withColorReduction(ABBREVIATIONS, wl.color, visualColorFor(wl.color)),
  );

  const characterCount = r.title.length;
  const status = getStatus(characterCount);
  const valid = characterCount <= MAX_LENGTH;

  const notes: string[] = [];
  if (colorNorm.note) notes.push(colorNorm.note);
  if (r.abbreviated) notes.push("Shortened using approved abbreviations");
  r.abbrevNotes.forEach((n) => notes.push(n)); // e.g. "Used slash format", "Bottom changed to Lower", color notes
  if (r.fitmentChanged) notes.push("Fits changed to For");
  if (r.yearChanged) notes.push(`Year shortened to ${r.year}`);
  if (r.productChanged) notes.push("Product wording shortened to Cover");
  let riskFlag: RiskFlag = "OK";
  if (!valid) {
    riskFlag = "CHECK";
    // Over 80: the title is shown WITH all entered data preserved (never trimmed
    // to fit). Surface the reason clearly for manual review.
    if (wl.variation.trim()) notes.push("Additional variation preserved; manual shortening needed");
    notes.push("Required input preserved; manual shortening needed");
    notes.push("Needs manual shortening");
  }

  return {
    accountId: account.id,
    accountName: account.name,
    accountStyleId: account.styleId,
    title: r.title,
    characterCount,
    status,
    riskFlag,
    notes: notes.join("; "),
    valid,
  };
}

/**
 * Shared "Bottom -> Lower" fallback. `Bottom` stays preferred; this is only
 * applied when a title is still over the limit after the earlier safe steps.
 * Never produces "Btm". This is the SAME transform the full abbreviation set
 * applies for the CSV / custom path, centralized here so both paths match.
 */
export function applyBottomLowerFallback(title: string): { title: string; changed: boolean } {
  const next = title.replace(/\bBottom\b/g, "Lower");
  return { title: next, changed: next !== title };
}

/**
 * Main-variation phrase fallback (Variation Matrix only). Tries an ordered list
 * of complete variation phrases (most complete first); each phrase is run
 * through the standard pipeline (abbreviations -> Fits→For -> year shortening).
 * The first phrase that yields a valid (<=80) title wins; otherwise the shortest
 * attempted phrase is returned, then the shared Bottom->Lower fallback is applied
 * if still too long (matching the CSV path), before flagging Too Long / CHECK.
 *
 * The phrase carries its own product wording, so the account's product token is
 * suppressed (product = "") to avoid duplicate "...Seat Cover ... Cover".
 */
export function generateWithPhraseStages(
  listing: ListingInput,
  account: AccountConfig,
  phraseStages: string[],
): GeneratedTitle {
  const baseFit: FitmentWord = account.preferredFitmentWord || listing.fitment;
  const colorNorm = normalizeColorForTitle(listing.color);
  const baseListing: ListingInput = { ...listing, color: colorNorm.color };
  // Guarantee the Additional Variation slot exists for this account when needed.
  const eaccount: AccountConfig = { ...account, titleStructure: ensureVariationToken(account.titleStructure, baseListing) };
  const rules = withColorReduction(PHRASE_ABBREVIATIONS, baseListing.color, visualColorFor(baseListing.color));

  // The bare "Front Seats" last resort is only accurate when the product is the
  // plain full-front coverage. An Additional Variation (Headrest, Armrest, …)
  // changes the coverage, so that stage is skipped — "Front Seat Covers" stays
  // the floor and the variation token is preserved as usual. If a caller passed
  // ONLY that stage (degenerate slice), keep the original list rather than
  // running with no stages at all.
  const filtered = baseListing.variation.trim()
    ? phraseStages.filter((p) => p !== "Front Seats")
    : phraseStages;
  const stages = filtered.length > 0 ? filtered : phraseStages;

  let chosen: PipelineResult | null = null;
  let chosenPhrase = "";
  let chosenIndex = 0;

  for (let i = 0; i < stages.length; i++) {
    const phrase = stages[i];
    const r = runPipeline({ ...baseListing, position: phrase }, eaccount, baseFit, "", false, rules);
    if (r.title.length <= MAX_LENGTH) {
      chosen = r;
      chosenPhrase = phrase;
      chosenIndex = i;
      break;
    }
    // Remember the last (shortest) attempt as the fallback if nothing fits.
    chosen = r;
    chosenPhrase = phrase;
    chosenIndex = i;
  }

  const r = chosen as PipelineResult;
  let title = r.title;

  const notes: string[] = [];
  if (colorNorm.note) notes.push(colorNorm.note);
  if (r.abbreviated) notes.push("Shortened using approved abbreviations");
  r.abbrevNotes.forEach((n) => notes.push(n)); // color fallback / "Color shortened" notes
  if (chosenIndex > 0) notes.push(`Variation phrase shortened to "${chosenPhrase}"`);
  if (chosenPhrase.includes("/")) notes.push("Used slash format");
  // "Front …" phrases without Top/Bottom exist only in the FULL front variation
  // (Driver & Passenger, Top & Bottom) ladder, so this note is accurate there
  // and never fires for driver-only / tops-only / bottoms-only / rear stages.
  if (/^Front\b/.test(chosenPhrase) && !/\b(?:Top|Bottom)\b/.test(chosenPhrase)) notes.push("Used Front Seats fallback");
  else if (/\bFront\b/.test(chosenPhrase)) notes.push("Used front fallback");
  else if (/\bSide\b/.test(chosenPhrase)) notes.push("Used side fallback");
  if (r.fitmentChanged) notes.push("Fits changed to For");
  if (r.yearChanged) notes.push(`Year shortened to ${r.year}`);

  // Step 8: shared Bottom -> Lower fallback — only when still over the limit
  // after the phrase stages, Fits→For, and year shortening (the same rule the
  // CSV / custom path applies via the shared abbreviation set). "Bottom" stays
  // preferred otherwise, and "Btm" is never used.
  if (title.length > MAX_LENGTH) {
    const bl = applyBottomLowerFallback(title);
    if (bl.changed) {
      title = bl.title;
      notes.push("Bottom changed to Lower");
    }
  }

  const characterCount = title.length;
  const status = getStatus(characterCount);
  const valid = characterCount <= MAX_LENGTH;
  let riskFlag: RiskFlag = "OK";
  if (!valid) {
    riskFlag = "CHECK";
    if (baseListing.variation.trim()) notes.push("Additional variation preserved; manual shortening needed");
    notes.push("Required input preserved; manual shortening needed");
    notes.push("Needs manual shortening");
  }

  return {
    accountId: account.id,
    accountName: account.name,
    accountStyleId: account.styleId,
    title,
    characterCount,
    status,
    riskFlag,
    notes: notes.join("; "),
    valid,
  };
}

/**
 * Generate one title per ACTIVE account. The generator simply loops over the
 * enabled accounts, so adding accounts later automatically adds title options
 * without touching this function.
 */
export function generateForAllAccounts(
  listing: ListingInput,
  accounts: AccountConfig[],
): GeneratedTitle[] {
  return accounts.filter((a) => a.enabled).map((a) => generateForAccount(listing, a));
}

/** Re-evaluate an edited/selected title's character count and status. */
export function evaluateTitle(title: string): { characterCount: number; status: Status; valid: boolean } {
  const characterCount = title.length;
  const status = getStatus(characterCount);
  return { characterCount, status, valid: characterCount <= MAX_LENGTH };
}
