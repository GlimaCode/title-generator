// ---------------------------------------------------------------------------
// CSV helpers: robust parsing of uploaded listing CSVs and building the two
// export files (selected titles, and all account title options).
// ---------------------------------------------------------------------------

import type { BatchItemMeta, BatchRow, FitmentWord, ListingInput, ProductWording } from "../types";
import { getStatus } from "../titleGenerator";

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Parse CSV text into a matrix of strings, honoring quotes and escaped quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Strip a UTF-8 BOM if present.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore; handled by the following \n (or end of input below)
    } else {
      field += c;
    }
  }
  // Flush the final field/row if there's trailing content.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/** Normalize a header to an alphanumeric key, e.g. "Image URL" -> "imageurl". */
function normKey(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Maps a normalized header to a logical field name.
const HEADER_MAP: Record<string, string> = {
  itemid: "itemId",
  id: "itemId",
  url: "url",
  link: "url",
  imageurl: "imageUrl",
  imgurl: "imageUrl",
  image: "imageUrl",
  quantitysold: "quantitySold",
  qtysold: "quantitySold",
  sold: "quantitySold",
  oldtitle: "oldTitle",
  currenttitle: "oldTitle",
  yearrange: "yearRange",
  year: "yearRange",
  years: "yearRange",
  fitment: "fitment",
  fitmentword: "fitment",
  make: "make",
  brand: "make",
  model: "model",
  seatposition: "position",
  position: "position",
  seatpos: "position",
  material: "material",
  variation: "variation",
  variant: "variation",
  color: "color",
  colour: "color",
  producttype: "productType",
  product: "productType",
};

const VALID_FITMENT: FitmentWord[] = ["Fits", "For"];
const VALID_PRODUCT: ProductWording[] = [
  "Seat Cover",
  "Cover",
  "Replacement Cover",
  "Upholstery Cover",
  "Bottom Cover",
  "Top Cover",
];

export interface ParsedListingRow {
  meta: BatchItemMeta;
  listing: ListingInput;
}

export interface ParseResult {
  rows: ParsedListingRow[];
  /** Required logical columns that were missing from the header. */
  missingColumns: string[];
}

const REQUIRED_LOGICAL = ["make", "model", "yearRange", "position", "material", "color"];

/** Parse an uploaded listing CSV into batch-ready rows. */
export function parseListingCsv(text: string): ParseResult {
  const matrix = parseCsv(text);
  if (matrix.length === 0) return { rows: [], missingColumns: REQUIRED_LOGICAL };

  const headerRow = matrix[0];
  const fieldByIndex: (string | undefined)[] = headerRow.map((h) => HEADER_MAP[normKey(h)]);
  const present = new Set(fieldByIndex.filter(Boolean) as string[]);
  const missingColumns = REQUIRED_LOGICAL.filter((c) => !present.has(c));

  const rows: ParsedListingRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const get = (field: string): string => {
      const idx = fieldByIndex.indexOf(field);
      return idx >= 0 && cells[idx] !== undefined ? cells[idx].trim() : "";
    };

    const fitmentRaw = get("fitment");
    const fitment: FitmentWord = (VALID_FITMENT as string[]).includes(fitmentRaw)
      ? (fitmentRaw as FitmentWord)
      : "Fits";

    const productRaw = get("productType");
    const productType: ProductWording = (VALID_PRODUCT as string[]).includes(productRaw)
      ? (productRaw as ProductWording)
      : "Seat Cover";

    rows.push({
      meta: {
        itemId: get("itemId"),
        url: get("url"),
        imageUrl: get("imageUrl"),
        quantitySold: get("quantitySold"),
        oldTitle: get("oldTitle"),
      },
      listing: {
        yearRange: get("yearRange"),
        make: get("make"),
        model: get("model"),
        position: get("position"),
        material: get("material"),
        variation: get("variation"),
        color: get("color"),
        fitment,
        productType,
      },
    });
  }

  return { rows, missingColumns };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function csvField(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsvText(header: string[], rows: (string | number)[][]): string {
  const lines = [header.map(csvField).join(",")];
  for (const r of rows) lines.push(r.map(csvField).join(","));
  return lines.join("\r\n");
}

/** Export ONE row per item: the user's selected (possibly edited) final title. */
export function buildSelectedTitlesCsv(rows: BatchRow[]): string {
  const header = [
    "item-id",
    "url",
    "image url",
    "quantity sold",
    "old_title",
    "account_name",
    "selected_new_title",
    "new_title_length",
    "status",
    "risk_flag",
    "notes",
  ];

  const out = rows.map((row) => {
    const selectedOption = row.options.find((o) => o.accountId === row.selectedAccountId) || null;
    const title = row.selectedTitle;
    const length = title.length;
    const status = getStatus(length);
    const tooLong = length > 80;
    const edited = selectedOption ? title !== selectedOption.title : title.length > 0;

    const accountName = selectedOption ? selectedOption.accountName : "";
    const riskFlag = tooLong ? "CHECK" : "OK";
    const notes = tooLong
      ? "Needs manual shortening"
      : edited
        ? "Manually edited"
        : selectedOption
          ? selectedOption.notes
          : "";

    return [
      row.meta.itemId,
      row.meta.url,
      row.meta.imageUrl,
      row.meta.quantitySold,
      row.meta.oldTitle,
      accountName,
      title,
      length,
      status,
      riskFlag,
      notes,
    ];
  });

  return toCsvText(header, out);
}

/** Export ALL account title options: one row per (item × account). */
export function buildAllOptionsCsv(rows: BatchRow[]): string {
  const header = [
    "item-id",
    "url",
    "image url",
    "quantity sold",
    "old_title",
    "account_name",
    "generated_title",
    "title_length",
    "status",
    "risk_flag",
    "notes",
  ];

  const out: (string | number)[][] = [];
  for (const row of rows) {
    for (const opt of row.options) {
      out.push([
        row.meta.itemId,
        row.meta.url,
        row.meta.imageUrl,
        row.meta.quantitySold,
        row.meta.oldTitle,
        opt.accountName,
        opt.title,
        opt.characterCount,
        opt.status,
        opt.riskFlag,
        opt.notes,
      ]);
    }
  }

  return toCsvText(header, out);
}

/** A sample input CSV the user can download as a template. */
export const SAMPLE_CSV = [
  "item-id,url,image url,quantity sold,old_title,year_range,make,model,seat_position,material,variation,color,product_type",
  '101,https://ebay.com/itm/101,https://img/101.jpg,12,"Old Ford Seat Cover",2014-2018,Ford,F-150,Driver Bottom,Leather,Perforated,Black,Seat Cover',
  '102,https://ebay.com/itm/102,https://img/102.jpg,3,"Old Chevy Cover",2003-2007,Chevy,Silverado 1500,Passenger Bottom,Genuine Leather,,Tan,Seat Cover',
  '103,https://ebay.com/itm/103,https://img/103.jpg,40,"Old Toyota Cover",2010-2015,Toyota,Camry,Front Bottom,Cloth,2-Tone,Gray,Cover',
  '104,https://ebay.com/itm/104,https://img/104.jpg,7,"Old Honda Cover",2016-2020,Honda,Civic,Rear Bottom,Vinyl,,Beige,Seat Cover',
  '105,https://ebay.com/itm/105,https://img/105.jpg,21,"Old RAM Cover",2009-2012,RAM,1500 2500 3500,Driver Bottom,Genuine Leather,Perforated,Black,Replacement Cover',
].join("\r\n");
