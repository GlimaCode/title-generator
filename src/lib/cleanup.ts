// ---------------------------------------------------------------------------
// Shared title cleanup — used by the CSV Account Title Generator (and any
// future free-text title input) before the title is parsed and rewritten by
// the shared generation pipeline.
//
// Strips eBay clutter (decorative symbols, quotes, wrapping hyphens, trailing
// trim/codes, quantity markers), normalizes year ranges (broken multi-segment
// AND space-separated), and corrects obvious safe typos — WITHOUT touching real
// hyphens in models (CR-V, F-150, CX-5) or real model numbers (1500, GX470).
//
// Every meaningful change is recorded as an informational note.
// ---------------------------------------------------------------------------

export interface CleanupResult {
  cleaned: string;
  notes: string[];
}

// Common eBay-listing typos for protected/critical words.
const TYPOS: { re: RegExp; to: string }[] = [
  { re: /\bDiver\b/gi, to: "Driver" },
  { re: /\bDrivar\b/gi, to: "Driver" },
  { re: /\bDirver\b/gi, to: "Driver" },
  { re: /\bPassanger\b/gi, to: "Passenger" },
  { re: /\bPasenger\b/gi, to: "Passenger" },
  { re: /\bPassener\b/gi, to: "Passenger" },
  { re: /\bGeniune\b/gi, to: "Genuine" },
  { re: /\bLether\b/gi, to: "Leather" },
];

/** Normalize a malformed multi-segment year range, e.g. 2003-2007-09 -> 2003-2009. */
function normalizeBrokenYears(text: string): { text: string; range: string | null } {
  let range: string | null = null;
  const out = text.replace(/\b\d{4}(?:-\d{2,4}){2,}\b/g, (m) => {
    const segs = m.split("-");
    const start = segs[0];
    const prev = segs[segs.length - 2];
    const last = segs[segs.length - 1];
    const end = last.length === 4 ? last : prev.slice(0, 2) + last.padStart(2, "0");
    range = `${start}-${end}`;
    return range;
  });
  return { text: out, range };
}

/** Merge two standalone adjacent 4-digit years into a range (2012 2018 -> 2012-2018). */
function normalizeSpacedYears(text: string): { text: string; range: string | null } {
  // Not preceded/followed by a digit or hyphen (so it never touches an existing
  // range like "2012-2018 2020" or model numbers).
  const m = text.match(/(?<![\d-])((?:19|20)\d{2})\s+((?:19|20)\d{2})(?![\d-])/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (b > a && b - a <= 40) {
      const range = `${m[1]}-${m[2]}`;
      return { text: text.replace(m[0], range), range };
    }
  }
  return { text, range: null };
}

export function cleanTitle(raw: string): CleanupResult {
  let t = (raw || "").replace(/\s+/g, " ").trim();
  const notes: string[] = [];

  // 1. Typo corrections (safe, confident) → informational note.
  const fixedTypos = new Set<string>();
  for (const typo of TYPOS) {
    if (typo.re.test(t)) {
      t = t.replace(typo.re, typo.to);
      fixedTypos.add(typo.to);
    }
  }
  for (const to of fixedTypos) notes.push(`Corrected likely ${to} typo`);

  // 2. Remove emphasis symbols and quotation marks.
  t = t.replace(/[+"'“”‘’]/g, " ");

  // 3. Remove decorative wrapping hyphens like "-TAN-" (keeps CR-V, F-150, ranges).
  t = t.replace(/(^|\s)-([A-Za-z0-9]+)-(?=\s|$)/g, "$1$2");

  // 4. Remove trailing/embedded trim/color codes (#, code, trim, color code …).
  let codeRemoved = false;
  const codePatterns = [
    /\b(?:color\s*code|trim\s*code)\s*#?\s*\d+/gi,
    /\btrim\s*#?\s*\d+/gi,
    /\bcode\s*#?\s*\d+/gi,
    /#\s*\d+/g,
  ];
  for (const re of codePatterns) {
    if (re.test(t)) {
      t = t.replace(re, " ");
      codeRemoved = true;
    }
  }
  if (codeRemoved) notes.push("Removed trailing code");

  // 5. Normalize broken multi-segment year ranges.
  const broken = normalizeBrokenYears(t);
  t = broken.text;
  if (broken.range) notes.push(`Normalized year range to ${broken.range}`);

  // 6. Normalize space-separated years (2012 2018 -> 2012-2018).
  const spaced = normalizeSpacedYears(t);
  t = spaced.text;
  if (spaced.range) notes.push(`Normalized spaced years to ${spaced.range}`);

  // 7. Remove standalone quantity markers (2x, 2X, x2) — never touches CR-V / CX-5.
  t = t.replace(/(^|\s)(?:\d+\s*[xX]|[xX]\s*\d+)(?=\s|$)/g, "$1");

  // 8. Normalize spacing.
  t = t.replace(/\s+/g, " ").trim();

  return { cleaned: t, notes };
}
