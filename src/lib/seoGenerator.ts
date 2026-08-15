// ---------------------------------------------------------------------------
// SEO content generator — builds Meta Tags, Meta Description, and an account-
// specific Mobile Description from a parsed title (SeoInfo).
// ---------------------------------------------------------------------------

import type { AccountConfig } from "../types";
import { parseForSeo, type SeoInfo } from "./seoParser";
import { toCsvText } from "./csv";

export interface SeoResult {
  title: string;
  accountName: string;
  metaTags: string;
  metaDescription: string;
  mobileDescription: string;
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const k = x.trim().toLowerCase();
    if (x.trim() && !seen.has(k)) {
      seen.add(k);
      out.push(x.trim());
    }
  }
  return out;
}

// --- Meta Tags -------------------------------------------------------------

const META_TAG_CONSTANTS = [
  "premium auto seat cover",
  "OEM replacement seat cover",
  "factory match upholstery",
  "exact fit seat cover",
  "made in USA",
  "high-quality automotive upholstery",
  "car seat replacement cover",
  "factory original fit",
  "direct replacement seat cover",
  "OEM spec auto upholstery",
  "precut & ready to install seat cover",
  "exact color match seat cover",
  "vehicle-specific seat cover",
  "handcrafted in the USA",
  "auto interior restoration",
  "high-quality seat replacement",
  "durable automotive upholstery",
  "compatible with heated & cooled seats",
];

function positionTags(d: SeoInfo["descr"]): string[] {
  const sides: string[] = [];
  if (d.driver) sides.push("driver");
  if (d.passenger) sides.push("passenger");
  if (!sides.length) sides.push("front");
  const out: string[] = [];
  for (const s of sides) {
    if (d.front) out.push(`front ${s} top seat cover`);
    if (d.side) out.push(`${s} side seat cover`);
    out.push(`${s} seat back cover`);
    out.push(`${s} upper seat cover`);
    if (d.bottom) {
      out.push(`${s} bottom seat cover`);
      out.push(`${s} seat cushion cover`);
    }
    if (d.top) out.push(`${s} top seat cover`);
    out.push(`${s} seat cover`);
  }
  return out;
}

export function generateMetaTags(info: SeoInfo): string {
  const mm = `${info.make} ${info.model}`.replace(/\s+/g, " ").trim();
  const tags: string[] = [];

  for (const y of info.years) tags.push(`${y} ${mm} seat cover`);

  if (info.color && info.material) tags.push(`${info.colorLower} ${info.materialLower} seat cover`);

  if (info.perforated && info.isLeather) tags.push("perforated leather car seat cover");
  else if (info.perforated) tags.push("perforated seat cover");

  // material-specific
  if (info.isLeather) tags.push(/genuine/i.test(info.material) ? "genuine leather seat cover" : "leather seat cover");
  else if (/leatherette/i.test(info.material)) tags.push("leatherette seat cover", "synthetic leather car seat cover");
  else if (/vinyl/i.test(info.material)) tags.push("vinyl seat cover");
  else if (/cloth/i.test(info.material)) tags.push("cloth seat cover");

  tags.push(...positionTags(info.descr));
  tags.push(...META_TAG_CONSTANTS);

  if (mm) tags.push(`${mm} interior accessories`);
  if (info.descr.driver && info.model) tags.push(`driver seat upholstery replacement ${info.model}`);
  if (info.isLeather && info.descr.driver) tags.push("leather driver seat back cover replacement");
  tags.push("precision fit OEM style seat cover");

  return dedupe(tags).join(", ");
}

// --- Meta Description ------------------------------------------------------

/**
 * Universal sentence-based Meta Description. Vehicle = make + model + chassis
 * (no color words / color value is ever inserted here — color stays in Meta
 * Tags only). Uses the best available parsed year/vehicle; never invents data.
 */
export function generateMetaDescription(info: SeoInfo): string {
  const vehicle = [info.make, info.model, info.chassis].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  // Always use the FULL normalized year range — never title-shortened years.
  // info.years is expanded from the parsed range (e.g. "2013-17" -> 2013..2017),
  // so first–last gives the full "2013-2017" form.
  const yr =
    info.years.length >= 2
      ? `${info.years[0]}-${info.years[info.years.length - 1]}`
      : info.years[0] || info.yearRange;
  return `Restore your ${yr} ${vehicle} interior with premium US-made OEM replacement seat covers. Factory-match color, material, and perfect fit.`
    .replace(/\s+/g, " ")
    .trim();
}

// --- Mobile Description (account-specific) ---------------------------------

export const MOBILE_FALLBACK =
  "Upgrade your vehicle interior with premium OEM-style replacement seat covers made with high-quality automotive materials. Enjoy factory-style fit, durable craftsmanship, fast shipping, 30-day returns, and a 1-year warranty. Tap to learn more.";

export const MOBILE_BY_NAME: Record<string, string> = {
  StoreBeta:
    "Factory-match OEM-replacement seat covers made in our own facility with top-quality automotive materials. Free shipping, free 30-day returns, 1-year warranty. Click to see what makes us different.",
  StoreDelta:
    "Premium OEM-style replacement seat covers for drivers upgrading their interiors. Expert craftsmanship and top-quality materials. Fast, free shipping, 30-day returns, and a 1-year warranty included.",
  StoreGamma:
    "Upgrade your ride with OEM-style seat covers built in our own facility using top-grade automotive materials for a precision fit. Free shipping, easy 30-day returns, and a 1-year warranty.",
  StoreEpsilon:
    "Discover premium, factory-style replacement seat covers crafted with expert precision. High-quality materials, perfect fits, lasting durability. Free shipping, 30-day returns, 1-year warranty.",
  StoreZeta:
    "Experience top-tier craftsmanship with our OEM-style replacement seat covers, made using premium automotive materials. Free shipping, 30-day returns, and a 1-year warranty included.",
  StoreAlpha:
    "Join thousands of satisfied drivers who trust our handcrafted seat covers, made with care and quality. Free shipping, 30-day returns, and a 1-year warranty.",
};

/** Resolve an account's mobile description (custom template → name map → fallback). */
export function generateMobileDescription(account: AccountConfig | null): string {
  if (account?.mobileDescription && account.mobileDescription.trim()) return account.mobileDescription.trim();
  if (account && MOBILE_BY_NAME[account.name]) return MOBILE_BY_NAME[account.name];
  return MOBILE_FALLBACK;
}

/** Effective mobile template for prefilling the Account Settings editor. */
export function defaultMobileTemplate(accountName: string): string {
  return MOBILE_BY_NAME[accountName] ?? MOBILE_FALLBACK;
}

// --- Combined ---------------------------------------------------------------

export function generateSeo(title: string, account: AccountConfig | null): SeoResult {
  const info = parseForSeo(title);
  return {
    title,
    accountName: account?.name ?? "",
    metaTags: generateMetaTags(info),
    metaDescription: generateMetaDescription(info),
    mobileDescription: generateMobileDescription(account),
  };
}

// --- CSV --------------------------------------------------------------------

export function buildSeoCsv(rows: SeoResult[]): string {
  const header = ["title", "account_name", "meta_tags", "meta_description", "mobile_description"];
  const out = rows.map((r) => [r.title, r.accountName, r.metaTags, r.metaDescription, r.mobileDescription]);
  return toCsvText(header, out);
}
