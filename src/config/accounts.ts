// ---------------------------------------------------------------------------
// Account configuration.
//
// This is the single source of truth for the eBay accounts the generator
// produces titles for. Each ACTIVE (enabled) account yields exactly one title
// option per listing.
//
// >>> TO ADD A NEW ACCOUNT LATER <<<
// Just append another object to DEFAULT_ACCOUNTS (or add it from the in-app
// Account Settings panel). Give it a unique `id` and `styleId`, choose a
// `titleStructure`, and the Manual Generator, CSV Batch Processor, exports, and
// history will all include it automatically — no other code needs to change.
//
// Notes on the fields:
//   - preferredFitmentWord ...... "Fits" (preferred) or "For".
//   - preferredProductWording ... the wording this account uses for the product
//                                  token. Leave "" to inherit the listing's
//                                  Product Type. All options are accurate
//                                  descriptors of a seat-cover product.
//   - usesVariation ............. when true AND the listing has a Variation
//                                  value, the variation token is rendered.
//   - titleStructure ............ ordered tokens defining the title layout.
//                                  Reordering changes the look while keeping the
//                                  exact same product meaning.
// ---------------------------------------------------------------------------

import type { AccountConfig } from "../types";

export const DEFAULT_ACCOUNTS: AccountConfig[] = [
  {
    id: "store-alpha",
    name: "StoreAlpha",
    enabled: true,
    styleId: "style-01",
    preferredFitmentWord: "Fits",
    preferredProductWording: "Seat Cover",
    usesVariation: false,
    titleStructure: ["year", "fitment", "make", "model", "position", "material", "productType", "color"],
  },
  {
    id: "store-beta",
    name: "StoreBeta",
    enabled: true,
    styleId: "style-02",
    preferredFitmentWord: "Fits",
    preferredProductWording: "Seat Cover",
    usesVariation: false,
    titleStructure: ["fitment", "year", "make", "model", "position", "material", "productType", "color"],
  },
  {
    id: "store-gamma",
    name: "StoreGamma",
    enabled: true,
    styleId: "style-03",
    preferredFitmentWord: "Fits",
    preferredProductWording: "Cover",
    usesVariation: false,
    titleStructure: ["year", "fitment", "make", "model", "material", "position", "productType", "color"],
  },
  {
    id: "diy",
    name: "DIY",
    enabled: true,
    styleId: "style-04",
    preferredFitmentWord: "For",
    preferredProductWording: "Cover",
    usesVariation: false,
    titleStructure: ["fitment", "make", "model", "year", "position", "material", "productType", "color"],
  },
  {
    id: "master",
    name: "Master",
    enabled: true,
    styleId: "style-05",
    preferredFitmentWord: "Fits",
    preferredProductWording: "Seat Cover",
    usesVariation: true,
    titleStructure: ["year", "fitment", "make", "model", "position", "variation", "material", "productType", "color"],
  },
  {
    id: "premium",
    name: "Premium",
    enabled: true,
    styleId: "style-06",
    preferredFitmentWord: "Fits",
    preferredProductWording: "Replacement Cover",
    usesVariation: false,
    titleStructure: ["year", "fitment", "make", "model", "color", "material", "position", "productType"],
  },
  {
    id: "elite",
    name: "Elite",
    enabled: true,
    styleId: "style-07",
    preferredFitmentWord: "For",
    preferredProductWording: "Upholstery Cover",
    usesVariation: false,
    titleStructure: ["fitment", "year", "make", "model", "color", "material", "position", "productType"],
  },
  {
    id: "dsa",
    name: "StoreDelta",
    enabled: true,
    styleId: "style-08",
    preferredFitmentWord: "Fits",
    preferredProductWording: "Seat Cover",
    usesVariation: true,
    titleStructure: ["year", "fitment", "make", "model", "position", "productType", "variation", "material", "color"],
  },
];
