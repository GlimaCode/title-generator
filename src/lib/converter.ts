// ---------------------------------------------------------------------------
// CSV Account Title Converter logic.
//
// For each input title:
//   1. cleanTitle()  — strip clutter, fix broken years, correct typos.
//   2. parseTitle()  — extract structured fields.
//   3. generateForAccount() — rewrite in the selected account's style (shared
//      shortening pipeline: abbreviations, slash, Fits→For, year, Bottom→Lower).
//
// Rows are split into two groups:
//   - Converted (confident, usable)  -> converted_titles.csv
//   - Manual check (uncertain/risky) -> manual_check_titles.csv
// ---------------------------------------------------------------------------

import type { AccountConfig, ConvertedRow, RiskFlag } from "../types";
import { processRawTitle } from "./titlePipeline";
import { parseCsv, toCsvText } from "./csv";

export interface ConverterInputRow {
  itemId: string;
  title: string;
}

/** Detect item-id + title columns (case-insensitive) and read the rows. */
export function parseConverterCsv(text: string): { rows: ConverterInputRow[]; hasTitle: boolean } {
  const matrix = parseCsv(text);
  if (matrix.length === 0) return { rows: [], hasTitle: false };

  const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
  const header = matrix[0];
  let idIdx = -1;
  let titleIdx = -1;
  header.forEach((h, i) => {
    const k = norm(h);
    if (idIdx < 0 && (k === "itemid" || k === "itemnumber" || k === "id" || k === "item")) idIdx = i;
    if (titleIdx < 0 && (k === "title" || k === "listingtitle" || k === "oldtitle")) titleIdx = i;
  });

  if (titleIdx < 0) return { rows: [], hasTitle: false };

  const rows: ConverterInputRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const title = (cells[titleIdx] ?? "").trim();
    if (!title) continue;
    rows.push({ itemId: idIdx >= 0 ? (cells[idIdx] ?? "").trim() : String(r), title });
  }
  return { rows, hasTitle: true };
}

/**
 * Convert one title into the selected account's style and decide whether it is
 * confident (converted) or uncertain (manual check). The best attempted title
 * is always produced, even for manual-check rows.
 */
export function convertTitle(
  itemId: string,
  oldTitle: string,
  account: AccountConfig,
  rowId: string,
): ConvertedRow {
  // Shared pipeline: clean → parse → rewrite in the account's style.
  const { cleanupNotes, parse, generated: g } = processRawTitle(oldTitle, account);
  const { listing, missing } = parse;

  // Reasons a row must be reviewed by a human before upload (genuine uncertainty).
  const reasons: string[] = [];
  if (missing.includes("make")) reasons.push("Make not detected");
  if (missing.includes("model")) reasons.push("Model not detected");
  if (missing.includes("position")) reasons.push("Seat position unclear");
  if (!listing.yearRange) reasons.push("Year range missing");
  if (!listing.material) reasons.push("Material unclear");
  if (!listing.color) reasons.push("Color unclear");
  if (!g.valid) reasons.push("Too long — needs manual shortening");
  if (g.riskFlag === "CHECK") reasons.push("Flagged CHECK by generator");

  const needsManualCheck = reasons.length > 0;

  // Notes: confident cleanup notes (always) + review reasons + generator notes.
  const noteParts: string[] = [...cleanupNotes];
  if (reasons.length) noteParts.push(...reasons);
  if (g.notes) noteParts.push(g.notes);

  const riskFlag: RiskFlag = needsManualCheck ? "CHECK" : "OK";

  return {
    rowId,
    itemId,
    oldTitle, // EXACT original input preserved
    newTitle: g.title,
    generatedTitle: g.title,
    characterCount: g.characterCount,
    status: g.status,
    riskFlag,
    notes: noteParts.join("; "),
    accountName: account.name,
    needsManualCheck,
  };
}

/** Convert all input rows for the selected account. */
export function convertAll(input: ConverterInputRow[], account: AccountConfig): ConvertedRow[] {
  return input.map((row, i) => convertTitle(row.itemId, row.title, account, `cv-${Date.now()}-${i}`));
}

// ---------------------------------------------------------------------------
// CSV export — two separate files
// ---------------------------------------------------------------------------

/**
 * converted_titles.csv — confident rows only.
 * Columns: item_id, old_title, new_title, pattern_used (= account name).
 */
export function buildConvertedCsv(rows: ConvertedRow[]): string {
  const header = ["item_id", "old_title", "new_title", "pattern_used"];
  const out = rows
    .filter((r) => !r.needsManualCheck)
    .map((r) => [r.itemId, r.oldTitle, r.newTitle, r.accountName]);
  return toCsvText(header, out);
}

/**
 * manual_check_titles.csv — rows needing human review.
 * Columns: item_id, old_title, attempted_new_title, selected_account, status, risk_flag, notes.
 */
export function buildManualCheckCsv(rows: ConvertedRow[]): string {
  const header = [
    "item_id",
    "old_title",
    "attempted_new_title",
    "selected_account",
    "status",
    "risk_flag",
    "notes",
  ];
  const out = rows
    .filter((r) => r.needsManualCheck)
    .map((r) => [r.itemId, r.oldTitle, r.newTitle, r.accountName, r.status, r.riskFlag, r.notes]);
  return toCsvText(header, out);
}
