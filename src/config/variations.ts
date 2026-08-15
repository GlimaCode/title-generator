// ---------------------------------------------------------------------------
// Variation configuration for the Vehicle Variation Matrix.
//
// MAIN_VARIATIONS .... the 9 primary seat-cover variations, always available.
// CUSTOM_VARIATIONS .. the larger optional list, generated separately.
//
// >>> TO ADD A VARIATION LATER <<<
// Add an object to MAIN_VARIATIONS, or just add a label string to
// CUSTOM_LABELS below — it becomes a configurable variation automatically.
// Nothing in the generation logic needs to change.
//
// A variation simply supplies the "seat component" wording that goes into each
// account's title (in place of a single seat position). All existing title /
// abbreviation rules still apply.
// ---------------------------------------------------------------------------

import type { VariationConfig } from "../types";
import { MAIN_VARIATION_PHRASE_STAGES } from "./variationPhraseStages";

// The 9 required primary variations. Phrase-fallback stages are attached below
// from variationPhraseStages.ts so the long phrase lists live in their own file.
const MAIN_VARIATIONS_BASE: VariationConfig[] = [
  { id: "m1", label: "Driver Top", type: "main", enabled: true, sortOrder: 1 },
  { id: "m2", label: "Passenger Top", type: "main", enabled: true, sortOrder: 2 },
  { id: "m3", label: "Driver Bottom", type: "main", enabled: true, sortOrder: 3 },
  { id: "m4", label: "Passenger Bottom", type: "main", enabled: true, sortOrder: 4 },
  { id: "m5", label: "Driver Top & Bottom", type: "main", enabled: true, sortOrder: 5 },
  { id: "m6", label: "Passenger Top & Bottom", type: "main", enabled: true, sortOrder: 6 },
  { id: "m7", label: "Driver & Passenger Tops", type: "main", enabled: true, sortOrder: 7 },
  { id: "m8", label: "Driver & Passenger Bottoms", type: "main", enabled: true, sortOrder: 8 },
  {
    id: "m9",
    label: "Driver & Passenger Top & Bottom",
    type: "main",
    enabled: true,
    sortOrder: 9,
    // Prefer the full label; only fall back to "Front Covers" when it is the
    // only way to fit 80 chars (never to imply a set / change meaning).
    shortLabel: "Front Covers",
    allowFrontCoversLabel: true,
  },
];

// Attach the ordered phrase-fallback stages to each main variation by id.
export const MAIN_VARIATIONS: VariationConfig[] = MAIN_VARIATIONS_BASE.map((v) => ({
  ...v,
  phraseStages: MAIN_VARIATION_PHRASE_STAGES[v.id] ?? v.phraseStages,
}));

// The larger optional list (order preserved). Add or remove labels freely.
const CUSTOM_LABELS: string[] = [
  "Armrest",
  "Headrest",
  "Center Console",
  "Foam Cushion",
  "Rear Bench Bottom",
  "Rear Bench Top",
  "Rear Driver Bottom",
  "Rear Passenger Bottom",
  "Rear Driver Top",
  "Rear Passenger Top",
  "Multi",
  "Driver or Passenger Bottom",
  "Driver or Passenger Top",
  "Bench",
  "Bench Top",
  "Bench Bottom",
  "Driver & Passenger Top & Bottom - Front & Rear",
  "Bench Top & Bottom",
  "Leg Extension",
  "Driver Top & Bottom & Headrest",
  "Driver & Passenger Headrests",
  "Driver & Passenger Top & Bottom & Headrest",
  "Driver & Passenger Tops & Headrests",
  "Passenger Top & Bottom & Headrest",
  "Bench Center Console",
  "Second Row Armrest",
  "Second Row Driver Bottom",
  "Second Row Passenger Bottom",
  "Second Row Driver Top",
  "Second Row Passenger Top",
  "Second Row Driver or Passenger Bottom Side",
  "Second Row Driver or Passenger Top Side",
  "Second Row Driver and Passenger Bottoms Side",
  "Second Row Driver and Passenger Tops Side",
  "Second Row Driver and Passenger Top and Bottom Side",
  "Second Row Driver Top & Bottom Side",
  "Second Row Passenger Top & Bottom Side",
  "Driver Armrest",
  "Passenger Armrest",
  "Driver or Passenger Armrest",
  "Driver & Passenger Armrest",
  "Driver & Passenger Top & Bottom & Headrest & Foam",
  "Rear Driver & Passenger Top & Bottom",
  "Rear Driver And Passenger Tops",
  "Rear Driver or Passenger Top",
  "Driver Leg Extension",
  "Driver & Passenger Top & Bottom & Center Console",
  "Driver & Passenger Top & Bottom & Armrest",
  "Rear Passenger Top and Bottom",
  "Rear Driver Top and Bottom",
  "Rear Driver and Passenger Bottoms",
  "Rear Bench Top & Bottom",
  "Rear Driver & Passenger Bottom",
  "Rear Driver Top & Bottom",
  "Rear Passenger Top & Bottom",
  "Rear Driver & Passenger Top",
  "Rear Driver or Passenger Bottom",
  "Rear Headrest",
  "Rear Driver & Passenger Bottoms",
  "Front & Rear",
];

export const CUSTOM_VARIATIONS: VariationConfig[] = CUSTOM_LABELS.map((label, i) => ({
  id: `c${i + 1}`,
  label,
  type: "custom",
  enabled: true,
  sortOrder: i + 1,
}));

/** All variations (main first, then custom). */
export const ALL_VARIATIONS: VariationConfig[] = [...MAIN_VARIATIONS, ...CUSTOM_VARIATIONS];
