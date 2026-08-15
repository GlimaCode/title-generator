// ---------------------------------------------------------------------------
// Shared title pipeline — the single source of truth for title rules used by
// the CSV Account Title Generator, Variation Matrix (via generateForAccount /
// generateWithPhraseStages), Custom Variations, and future title features.
//
//   cleanTitle()         — shared cleanup (symbols, codes, year normalization,
//                          typos). [src/lib/cleanup.ts]
//   parseTitle()         — shared structured parser. [src/lib/titleParser.ts]
//   generateForAccount() / generateWithPhraseStages() — shared shortening
//                          pipeline (abbreviations incl. color modifiers,
//                          Fits→For, year shortening, slash, Bottom→Lower,
//                          protected words, Too Long/CHECK). [src/titleGenerator.ts]
//
// Components must use these shared functions — do not duplicate title logic.
// ---------------------------------------------------------------------------

import type { AccountConfig, GeneratedTitle } from "../types";
import { cleanTitle } from "./cleanup";
import { parseTitle, type ParseResult } from "./titleParser";
import { generateForAccount, generateWithPhraseStages } from "../titleGenerator";

export { cleanTitle, parseTitle, generateForAccount, generateWithPhraseStages };

export interface ProcessedTitle {
  cleaned: string;
  cleanupNotes: string[];
  parse: ParseResult;
  generated: GeneratedTitle;
}

/**
 * Full pipeline for a RAW free-text title: clean → parse → rewrite in the
 * selected account's style. Used by the CSV Account Title Generator.
 */
export function processRawTitle(raw: string, account: AccountConfig): ProcessedTitle {
  const clean = cleanTitle(raw);
  const parse = parseTitle(clean.cleaned);
  const generated = generateForAccount(parse.listing, account);
  return { cleaned: clean.cleaned, cleanupNotes: clean.notes, parse, generated };
}
