// ---------------------------------------------------------------------------
// Main Variation Phrase Fallback stages.
//
// For each of the 9 main variations, an ordered list of complete, approved
// phrases — MOST COMPLETE FIRST. Each phrase bundles the seat component AND the
// product wording. The Variation Matrix generator tries them in order and keeps
// the first that produces a title <= 80 characters (after the normal
// abbreviation / Fits→For / year-shortening pipeline). If none fit, the shortest
// phrase is used and the title is flagged Too Long / CHECK.
//
// Slash forms ("Driver/Passenger", "Top/Bottom") are written with NO spaces
// around the slash, and keep the full words Driver / Passenger.
//
// Keyed by the main variation id (m1..m9) from variations.ts. Editing this file
// is all that's needed to change phrase priorities — components stay untouched.
// ---------------------------------------------------------------------------

export const MAIN_VARIATION_PHRASE_STAGES: Record<string, string[]> = {
  // 1. Driver Top
  m1: [
    "Driver Top Replacement Seat Cover",
    "Driver Top Replacement Cover",
    "Driver Top Seat Cover",
    "Driver Top Cover",
  ],
  // 2. Passenger Top
  m2: [
    "Passenger Top Replacement Seat Cover",
    "Passenger Top Replacement Cover",
    "Passenger Top Seat Cover",
    "Passenger Top Cover",
  ],
  // 3. Driver Bottom
  m3: [
    "Driver Bottom Replacement Seat Cover",
    "Driver Bottom Replacement Cover",
    "Driver Bottom Seat Cover",
    "Driver Bottom Cover",
  ],
  // 4. Passenger Bottom
  m4: [
    "Passenger Bottom Replacement Seat Cover",
    "Passenger Bottom Replacement Cover",
    "Passenger Bottom Seat Cover",
    "Passenger Bottom Cover",
  ],
  // 5. Driver Top & Bottom
  m5: [
    "Driver Top and Bottom Replacement Seat Covers",
    "Driver Top and Bottom Replacement Covers",
    "Driver Top and Bottom Seat Covers",
    "Driver Top and Bottom Covers",
    "Driver Top/Bottom Replacement Seat Covers",
    "Driver Top/Bottom Replacement Covers",
    "Driver Top/Bottom Seat Covers",
    "Driver Top/Bottom Covers",
    "Driver Side Replacement Seat Covers",
    "Driver Side Replacement Covers",
    "Driver Side Seat Covers",
    "Driver Side Covers",
    "Driver Replacement Seat Covers",
    "Driver Replacement Covers",
    "Driver Seat Covers",
    "Driver Covers",
  ],
  // 6. Passenger Top & Bottom
  m6: [
    "Passenger Top and Bottom Replacement Seat Covers",
    "Passenger Top and Bottom Replacement Covers",
    "Passenger Top and Bottom Seat Covers",
    "Passenger Top and Bottom Covers",
    "Passenger Top/Bottom Replacement Seat Covers",
    "Passenger Top/Bottom Replacement Covers",
    "Passenger Top/Bottom Seat Covers",
    "Passenger Top/Bottom Covers",
    "Passenger Side Replacement Seat Covers",
    "Passenger Side Replacement Covers",
    "Passenger Side Seat Covers",
    "Passenger Side Covers",
    "Passenger Replacement Seat Covers",
    "Passenger Replacement Covers",
    "Passenger Seat Covers",
    "Passenger Covers",
  ],
  // 7. Driver & Passenger Tops
  m7: [
    "Driver and Passenger Top Replacement Seat Covers",
    "Driver and Passenger Top Replacement Covers",
    "Driver and Passenger Top Seat Covers",
    "Driver and Passenger Top Covers",
    "Driver & Passenger Top Replacement Seat Covers",
    "Driver & Passenger Top Replacement Covers",
    "Driver & Passenger Top Seat Covers",
    "Driver & Passenger Top Covers",
    "Driver/Passenger Top Replacement Seat Covers",
    "Driver/Passenger Top Replacement Covers",
    "Driver/Passenger Top Seat Covers",
    "Driver/Passenger Top Covers",
    "Front Top Replacement Seat Covers",
    "Front Top Replacement Covers",
    "Front Top Seat Covers",
    "Front Top Covers",
  ],
  // 8. Driver & Passenger Bottoms
  m8: [
    "Driver and Passenger Bottom Replacement Seat Covers",
    "Driver and Passenger Bottom Replacement Covers",
    "Driver and Passenger Bottom Seat Covers",
    "Driver and Passenger Bottom Covers",
    "Driver & Passenger Bottom Replacement Seat Covers",
    "Driver & Passenger Bottom Replacement Covers",
    "Driver & Passenger Bottom Seat Covers",
    "Driver & Passenger Bottom Covers",
    "Driver/Passenger Bottom Replacement Seat Covers",
    "Driver/Passenger Bottom Replacement Covers",
    "Driver/Passenger Bottom Seat Covers",
    "Driver/Passenger Bottom Covers",
    "Front Bottom Replacement Seat Covers",
    "Front Bottom Replacement Covers",
    "Front Bottom Seat Covers",
    "Front Bottom Covers",
  ],
  // 9. Driver & Passenger Top & Bottom (full front-cover variation).
  // Full 16-stage ladder: "&" forms -> slash Top/Bottom -> slash Top/Lower ->
  // Front forms -> "Front Seats" (last resort). "Front Seats" is accurate ONLY
  // here because this variation covers Driver AND Passenger, Top AND Bottom.
  m9: [
    "Driver & Passenger Top & Bottom Replacement Seat Covers",
    "Driver & Passenger Top & Bottom Replacement Covers",
    "Driver & Passenger Top & Bottom Seat Covers",
    "Driver & Passenger Top & Bottom Covers",
    "Driver/Passenger Top/Bottom Replacement Seat Covers",
    "Driver/Passenger Top/Bottom Replacement Covers",
    "Driver/Passenger Top/Bottom Seat Covers",
    "Driver/Passenger Top/Bottom Covers",
    "Driver/Passenger Top/Lower Replacement Seat Covers",
    "Driver/Passenger Top/Lower Replacement Covers",
    "Driver/Passenger Top/Lower Seat Covers",
    "Driver/Passenger Top/Lower Covers",
    "Front Replacement Seat Covers",
    "Front Replacement Covers",
    "Front Seat Covers",
    "Front Seats",
  ],
};
