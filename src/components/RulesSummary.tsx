// ---------------------------------------------------------------------------
// Rules Summary — explains the generation guarantees and lists each account's
// title style under the "Account Title Styles" heading.
// ---------------------------------------------------------------------------

import { TOKEN_LABELS, type AccountConfig } from "../types";

export function RulesSummary({ accounts }: { accounts: AccountConfig[] }) {
  return (
    <section className="card rules-card" aria-label="Rules summary">
      <h2 className="card-title">Rules Summary</h2>

      <div className="rules-grid">
        <div>
          <h3>Account Title Styles</h3>
          <p className="muted-hint">
            Each account receives a <strong>different title structure</strong> while preserving the exact same
            product meaning — same year, make, model, position, material, color, and product. Only the ordering
            and the account's preferred fitment/product wording change.
          </p>
          <div className="rules-accounts">
            {accounts.map((a) => (
              <div key={a.id} className={`rules-account${a.enabled ? "" : " disabled"}`}>
                <div className="rules-account-head">
                  <span className="account-name">{a.name}</span>
                  {!a.enabled && <span className="muted-hint">(disabled)</span>}
                </div>
                <div className="account-style-preview">
                  {a.titleStructure.map((t, i) => (
                    <span key={`${t}-${i}`} className="token-chip">
                      {TOKEN_LABELS[t]}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3>Length &amp; Status</h3>
          <ul className="rules-list">
            <li>Every title is ≤ 80 characters, counting spaces, hyphens, slashes, commas, symbols, and periods.</li>
            <li>
              <span className="badge badge-good">Good</span> ≤ 70 ·{" "}
              <span className="badge badge-safe">Safe</span> 71–75 ·{" "}
              <span className="badge badge-near">Near Limit</span> 76–80 ·{" "}
              <span className="badge badge-toolong">Too Long</span> &gt; 80
            </li>
            <li>
              If a title cannot fit without removing important info, it is <strong>not faked</strong>. It is shown
              as <span className="badge badge-toolong">Too Long</span>, flagged <span className="badge badge-risk">⚑ CHECK</span>, and noted{" "}
              <em>“Needs manual shortening.”</em>
            </li>
          </ul>

          <h3>Preserved Exactly</h3>
          <ul className="rules-list">
            <li>Year range, make &amp; model, seat position, material meaning, color, variation (if present), and product type.</li>
            <li>No invented trims, fitment, item IDs, random words, or full-vehicle implications.</li>
            <li>Fitment uses only <code>Fits</code> (preferred) or <code>For</code> — never “Compatible With”, “Designed For”, etc.</li>
          </ul>

          <h3>Abbreviations</h3>
          <ul className="rules-list">
            <li><strong>Never</strong> shortened: <code>Genuine</code> (no <code>Gen.</code>), <code>Driver</code> (no <code>Drvr</code>), <code>Passenger</code> (no <code>Pass</code>/<code>Pass.</code>/<code>Psgr</code>), <code>Bottom</code> (no <code>Btm</code> — use <code>Lower</code>).</li>
            <li><strong>Protected materials:</strong> <code>Leather</code> and <code>Leatherette</code> always stay complete — never <code>Lthr.</code>, <code>Lthr</code>, or <code>Leath.</code>, and never removed to fit. A legacy <code>Lthr.</code> in an imported CSV is restored to <code>Leather</code>.</li>
            <li>Materials kept intact and distinct: Leatherette, Vinyl, Cloth, Suede, MB-Tex, Synthetic Leather (never turned into “Leather”).</li>
            <li><code>Replacement</code> fallback (in order, only while over 80): <code>Replacement→Repl.</code>, then <code>Repl.</code> removed — the product wording (<code>Seat Cover</code>/<code>Cover</code>) always remains.</li>
            <li>Allowed only when needed: <code>Perforated→Perf.</code>, <code>With→w/</code>, <code>Without→w/o</code>, <code>And→&amp;</code>, <code>Second Row→2nd Row</code>, <code>Center Console→Console</code>, <code>Bottom→Lower</code>, <code>Backrest→Back</code>, <code>Lean Back→Leanback</code>.</li>
          </ul>
        </div>
      </div>

      <div className="rules-matrix">
        <h3>Variation Matrix Rules</h3>
        <ul className="rules-list">
          <li>The <strong>9 main variations</strong> are always available (Driver/Passenger Tops, Bottoms, and their combinations).</li>
          <li>A larger set of <strong>additional variations</strong> is available separately, on demand — they don't auto-generate the full 9-matrix and keep the screen uncluttered.</li>
          <li><strong>Account-based generation</strong> produces one title per active account per variation (e.g. 9 variations × 8 accounts = 72 titles); add accounts and the totals grow automatically.</li>
          <li>
            <strong>Main variation phrase fallback:</strong> each main variation has an ordered list of approved
            phrases (most complete first, e.g. <em>“Driver Top Replacement Seat Cover” → “…Seat Cover” → “…Cover”</em>).
            The generator keeps the most complete phrase that fits 80 chars, stepping down only as needed —
            including slash forms (<code>Driver/Passenger</code>, <code>Top/Bottom</code>, full words kept) and, for the
            full front variation, <code>Front Seat Covers</code> when accurate. Notes record any fallback used.
          </li>
          <li>All title and abbreviation rules above still apply. Titles stay ≤ 80 characters whenever possible; anything that can't fit cleanly is shown as <span className="badge badge-toolong">Too Long</span> + <span className="badge badge-risk">⚑ CHECK</span> for manual editing — never faked.</li>
          <li>Each variation only changes the seat-component wording. The vehicle, material, color, and product meaning are preserved exactly (Bottom never becomes Top, Rear never becomes Front, no implied full sets).</li>
        </ul>
      </div>
    </section>
  );
}
