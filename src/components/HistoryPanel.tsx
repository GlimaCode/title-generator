// ---------------------------------------------------------------------------
// History — saved CSV batch runs and Variation Matrix sessions (localStorage).
// Reopen, delete, or clear all.
// ---------------------------------------------------------------------------

import type { HistoryRecord } from "../types";

interface Props {
  records: HistoryRecord[];
  onReopen: (record: HistoryRecord) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

function title(rec: HistoryRecord): string {
  if (rec.kind === "matrix") {
    const b = rec.base;
    const name = b ? [b.yearRange, b.make, b.model].filter(Boolean).join(" ") : "Matrix session";
    return b?.groupName ? `${b.groupName} — ${name}` : name || "Matrix session";
  }
  if (rec.kind === "convert") {
    return `${rec.fileName || "Converter run"}${rec.selectedAccount ? ` → ${rec.selectedAccount}` : ""}`;
  }
  return rec.fileName || "Batch run";
}

const KIND_META: Record<HistoryRecord["kind"], { label: string; cls: string; icon: string }> = {
  matrix: { label: "Matrix", cls: "kind-matrix", icon: "🚗" },
  batch: { label: "Batch", cls: "kind-batch", icon: "📄" },
  convert: { label: "Converter", cls: "kind-convert", icon: "🔁" },
};

export function HistoryPanel({ records, onReopen, onDelete, onClearAll }: Props) {
  return (
    <section className="card" aria-label="History">
      <div className="results-head">
        <h2 className="card-title">History</h2>
        {records.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClearAll}>
            Clear All History
          </button>
        )}
      </div>

      {records.length === 0 && (
        <p className="placeholder">No saved sessions yet. Process a CSV or a Variation Matrix and click “Save to History”.</p>
      )}

      {records.length > 0 && (
        <div className="history-list">
          {records.map((rec) => {
            const isMatrix = rec.kind === "matrix";
            const meta = KIND_META[rec.kind] ?? KIND_META.batch;
            const titleCount =
              (rec.mainBlocks ?? []).reduce((s, b) => s + b.titles.length, 0) +
              (rec.customBlocks ?? []).reduce((s, b) => s + b.titles.length, 0);
            return (
              <div key={rec.id} className="history-item">
                <div className="history-main">
                  <div className="history-title">
                    <span className={`kind-badge ${meta.cls}`}>{meta.label}</span>
                    <span className="history-file">{meta.icon} {title(rec)}</span>
                    <span className="history-date">{rec.dateTime}</span>
                  </div>
                  <div className="history-stats">
                    {isMatrix && <span>{titleCount} titles</span>}
                    {!isMatrix && <span>{rec.rowsProcessed ?? 0} rows</span>}
                    {rec.kind === "convert" ? (
                      <>
                        <span>{rec.convertedCount ?? rec.validCount} converted</span>
                        <span>{rec.manualCheckCount ?? 0} manual check</span>
                      </>
                    ) : (
                      <span>{rec.validCount} valid</span>
                    )}
                    <span>{rec.nearLimitCount} near limit</span>
                    <span>{rec.tooLongCount ?? 0} too long</span>
                    <span>{rec.accountsSnapshot.length} accounts</span>
                  </div>
                  <div className="history-accounts">
                    {rec.accountsSnapshot.map((a) => (
                      <span key={a.id} className="account-chip">
                        {a.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="history-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onReopen(rec)}>
                    Reopen
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDelete(rec.id)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
