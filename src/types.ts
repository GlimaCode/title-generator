// ---------------------------------------------------------------------------
// Shared types for the Seat Cover Title Batch Generator.
// ---------------------------------------------------------------------------

export type FitmentWord = "Fits" | "For";

/** Accurate product-wording options (all describe a seat cover product). */
export type ProductWording =
  | "Seat Cover"
  | "Cover"
  | "Replacement Cover"
  | "Upholstery Cover"
  | "Bottom Cover"
  | "Top Cover";

export type Status = "Good" | "Safe" | "Near Limit" | "Too Long";

/** Risk flag surfaced in the UI and CSV exports. */
export type RiskFlag = "OK" | "CHECK";

/**
 * The building blocks a title can be assembled from. An account's
 * `titleStructure` is just an ordered list of these tokens.
 */
export type TitleToken =
  | "year"
  | "fitment"
  | "make"
  | "model"
  | "position"
  | "material"
  | "variation"
  | "productType"
  | "color";

export const ALL_TOKENS: TitleToken[] = [
  "year",
  "fitment",
  "make",
  "model",
  "position",
  "material",
  "variation",
  "productType",
  "color",
];

/** Human-friendly labels for the tokens (used in the Account Settings editor). */
export const TOKEN_LABELS: Record<TitleToken, string> = {
  year: "Year Range",
  fitment: "Fits/For",
  make: "Make",
  model: "Model",
  position: "Seat Position",
  material: "Material",
  variation: "Variation",
  productType: "Product Type",
  color: "Color",
};

/**
 * The structured listing data shared across every account. These values are
 * preserved exactly (never reworded) so product meaning stays identical no
 * matter which account renders the title.
 */
export interface ListingInput {
  yearRange: string;
  make: string;
  model: string;
  position: string;
  material: string;
  variation: string; // optional
  color: string;
  // Global fallbacks — used only when an account does not specify its own.
  fitment: FitmentWord;
  productType: ProductWording;
}

/**
 * A configurable eBay account. Accounts are data, not code: add, remove, or
 * edit them (in src/config/accounts.ts or the Account Settings panel) and the
 * generator picks up the change automatically — no logic rewrite needed.
 */
export interface AccountConfig {
  id: string;
  name: string;
  enabled: boolean;
  styleId: string;
  preferredFitmentWord: FitmentWord;
  /** Account's product wording. "" means "inherit the listing's product type". */
  preferredProductWording: ProductWording | "";
  /** Whether this account weaves the Variation field into its titles. */
  usesVariation: boolean;
  /** Ordered tokens that define this account's title layout. */
  titleStructure: TitleToken[];
  /** Account-specific SEO mobile description template (optional; falls back by name). */
  mobileDescription?: string;
}

/** One generated title, tied to the account that produced it. */
export interface GeneratedTitle {
  accountId: string;
  accountName: string;
  accountStyleId: string;
  title: string;
  characterCount: number;
  status: Status;
  riskFlag: RiskFlag;
  notes: string;
  valid: boolean; // valid === within the 80-char limit
}

/** Per-item context carried through the batch processor and exports. */
export interface BatchItemMeta {
  itemId: string;
  url: string;
  imageUrl: string;
  quantitySold: string;
  oldTitle: string;
}

/** A single batch row: its source data, generated options, and selection. */
export interface BatchRow {
  rowId: string;
  meta: BatchItemMeta;
  listing: ListingInput;
  options: GeneratedTitle[]; // one per active account
  selectedAccountId: string | null;
  selectedTitle: string; // editable final title
}

// ----------------------------------------------------------- Variation Matrix

/**
 * A seat-cover variation (seat component coverage). "main" variations are the
 * always-available primary 9; "custom" are the larger optional list. Configured
 * in src/config/variations.ts so the set is easy to extend.
 */
export interface VariationConfig {
  id: string;
  label: string;
  type: "main" | "custom";
  enabled: boolean;
  sortOrder: number;
  aliases?: string[];
  /** Optional shorter wording used only as a last resort to fit 80 chars. */
  shortLabel?: string;
  /** If true, the shortLabel (e.g. "Front Covers") may be used to fit. */
  allowFrontCoversLabel?: boolean;
  /**
   * Ordered, most-complete-first list of full variation phrases (each bundles
   * the seat component + product wording). Used by the Variation Matrix main
   * variations: the generator tries them in order and keeps the first that
   * fits 80 chars. When present, this drives product wording (the account's
   * product token is suppressed to avoid duplication).
   */
  phraseStages?: string[];
}

/** Base vehicle/product inputs entered once for the whole matrix session. */
export interface MatrixBaseInput {
  yearRange: string;
  make: string;
  model: string;
  material: string;
  color: string;
  fitment: FitmentWord;
  productType: ProductWording;
  additionalVariation: string; // optional, e.g. "Perforated"
  notes: string; // optional session note (metadata only)
  groupName: string; // optional brand/vehicle group (metadata only)
}

/** One generated title within the matrix, tied to a variation + account. */
export interface MatrixTitle extends GeneratedTitle {
  variationId: string;
  variationName: string;
  variationType: "main" | "custom";
  editedTitle: string; // editable final title (defaults to the generated title)
}

/** A generated title published from the Variation Matrix to the SEO tab. */
export interface MatrixTitleRef {
  accountId: string;
  accountName: string;
  variationName: string;
  label: string;
  title: string;
}

/** All variation titles for a single account (one entry per variation). */
export interface AccountBlock {
  accountId: string;
  accountName: string;
  accountStyleId: string;
  titles: MatrixTitle[]; // one per variation, in variation order
}

/** One converted row in the CSV Account Title Converter. */
export interface ConvertedRow {
  rowId: string;
  itemId: string;
  oldTitle: string;
  newTitle: string; // editable final title (defaults to the generated title)
  generatedTitle: string; // the original machine-generated title (for reference)
  characterCount: number;
  status: Status;
  riskFlag: RiskFlag;
  notes: string;
  accountName: string; // the selected account whose style was applied
  /** True when the row needs human review (goes to manual_check_titles.csv). */
  needsManualCheck: boolean;
}

/**
 * A persisted history record. `kind` distinguishes a CSV batch run, a Variation
 * Matrix session, and a CSV Account Title Converter session. Older records
 * without `kind` are treated as batch.
 */
export interface HistoryRecord {
  id: string;
  kind: "batch" | "matrix" | "convert";
  dateTime: string;
  validCount: number;
  nearLimitCount: number;
  tooLongCount: number;
  accountsSnapshot: { id: string; name: string; styleId: string }[];

  // Batch-only
  fileName?: string;
  rowsProcessed?: number;
  rows?: BatchRow[];

  // Matrix-only
  base?: MatrixBaseInput;
  mainBlocks?: AccountBlock[];
  customBlocks?: AccountBlock[];

  // Converter-only
  selectedAccount?: string;
  convertedRows?: ConvertedRow[];
  convertedCount?: number;
  manualCheckCount?: number;
}
