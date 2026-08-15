// ---------------------------------------------------------------------------
// CSV Batch Processor — upload a CSV, generate per-account title options for
// every row, let the user select/edit a final title, then export.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import type { AccountConfig, BatchRow, HistoryRecord } from "../types";
import { evaluateTitle, generateForAllAccounts, MAX_LENGTH } from "../titleGenerator";
import {
  buildAllOptionsCsv,
  buildSelectedTitlesCsv,
  parseListingCsv,
  SAMPLE_CSV,
  type ParsedListingRow,
} from "../lib/csv";
import { downloadText } from "../lib/download";
import { CharCount, CopyButton, RiskBadge, StatusBadge } from "./ui";

/** Build batch rows from parsed CSV input, generating options per account. */
function makeBatchRows(parsed: ParsedListingRow[], accounts: AccountConfig[]): BatchRow[] {
  return parsed.map((p, i) => {
    const options = generateForAllAccounts(p.listing, accounts);
    const firstValid = options.find((o) => o.valid) ?? options[0] ?? null;
    return {
      rowId: `row-${Date.now()}-${i}`,
      meta: p.meta,
      listing: p.listing,
      options,
      selectedAccountId: firstValid ? firstValid.accountId : null,
      selectedTitle: firstValid ? firstValid.title : "",
    };
  });
}

interface Props {
  accounts: AccountConfig[];
  onSave: (record: HistoryRecord) => void;
  /** When set (e.g. reopened from history), loads these rows into the table. */
  restored: { fileName: string; rows: BatchRow[] } | null;
}

export function BatchProcessor({ accounts, onSave, restored }: Props) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  // Load a reopened history record into the table.
  useEffect(() => {
    if (restored) {
      setFileName(restored.fileName);
      setRows(restored.rows);
      setExpanded(new Set());
      setParseWarning(null);
    }
  }, [restored]);

  const stats = useMemo(() => {
    let valid = 0;
    let near = 0;
    let tooLong = 0;
    for (const r of rows) {
      const ev = evaluateTitle(r.selectedTitle);
      if (r.selectedTitle.trim().length > 0 && ev.valid) valid++;
      if (ev.status === "Near Limit") near++;
      if (ev.status === "Too Long") tooLong++;
    }
    return { rowsProcessed: rows.length, validCount: valid, nearLimitCount: near, tooLongCount: tooLong };
  }, [rows]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    loadCsvText(text, file.name);
  };

  const loadCsvText = (text: string, name: string) => {
    const { rows: parsed, missingColumns } = parseListingCsv(text);
    if (parsed.length === 0) {
      setParseWarning("No data rows found. Check the file has a header row and at least one listing.");
      setRows([]);
      setFileName(name);
      return;
    }
    setParseWarning(
      missingColumns.length > 0
        ? `Missing recommended columns: ${missingColumns.join(", ")}. Rows were still processed where possible.`
        : null,
    );
    setRows(makeBatchRows(parsed, accounts));
    setFileName(name);
    setExpanded(new Set());
  };

  const toggleExpand = (rowId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const selectOption = (rowId: string, accountId: string, title: string) => {
    setRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, selectedAccountId: accountId, selectedTitle: title } : r)),
    );
  };

  const editSelectedTitle = (rowId: string, title: string) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, selectedTitle: title } : r)));
  };

  const handleExportSelected = () => {
    if (rows.length === 0) return;
    downloadText("selected-titles.csv", buildSelectedTitlesCsv(rows));
  };

  const handleExportAll = () => {
    if (rows.length === 0) return;
    downloadText("all-account-title-options.csv", buildAllOptionsCsv(rows));
  };

  const handleSaveHistory = () => {
    if (rows.length === 0) return;
    const record: HistoryRecord = {
      id: `hist-${Date.now()}`,
      kind: "batch",
      dateTime: new Date().toLocaleString(),
      fileName: fileName || "untitled.csv",
      rowsProcessed: stats.rowsProcessed,
      validCount: stats.validCount,
      nearLimitCount: stats.nearLimitCount,
      tooLongCount: stats.tooLongCount,
      rows,
      accountsSnapshot: accounts.map((a) => ({ id: a.id, name: a.name, styleId: a.styleId })),
    };
    onSave(record);
    setSavedNote(true);
    window.setTimeout(() => setSavedNote(false), 1800);
  };

  return (
    <section className="card" aria-label="CSV batch processor">
      <h2 className="card-title">CSV Batch Processor</h2>

      <div className="batch-toolbar">
        <label className="btn btn-primary file-btn">
          Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <button type="button" className="btn btn-ghost" onClick={() => loadCsvText(SAMPLE_CSV, "sample.csv")}>
          Load Sample (5 rows)
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => downloadText("template.csv", SAMPLE_CSV)}>
          Download Template
        </button>
        {fileName && <span className="file-name">📄 {fileName}</span>}
      </div>

      {parseWarning && (
        <div className="warning" role="alert">
          {parseWarning}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="batch-stats">
            <span>
              <strong>{stats.rowsProcessed}</strong> rows
            </span>
            <span>
              <strong>{stats.validCount}</strong> valid selected
            </span>
            <span>
              <strong>{stats.nearLimitCount}</strong> near limit
            </span>
          </div>

          <div className="results-actions">
            <button type="button" className="btn btn-secondary" onClick={handleExportSelected}>
              Export Selected Titles
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleExportAll}>
              Export All Account Title Options
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleSaveHistory}>
              {savedNote ? "✓ Saved to History" : "Save to History"}
            </button>
          </div>

          <div className="batch-rows">
            {rows.map((row) => {
              const ev = evaluateTitle(row.selectedTitle);
              const isOpen = expanded.has(row.rowId);
              const selectedOpt = row.options.find((o) => o.accountId === row.selectedAccountId);
              return (
                <div key={row.rowId} className={`batch-row${ev.valid ? "" : " invalid"}`}>
                  <div className="batch-row-head">
                    <div className="batch-row-id">
                      <span className="item-id">#{row.meta.itemId || "—"}</span>
                      <span className="old-title" title={row.meta.oldTitle}>
                        {row.meta.oldTitle || "(no old title)"}
                      </span>
                    </div>
                    <button type="button" className="link-btn" onClick={() => toggleExpand(row.rowId)}>
                      {isOpen ? "Hide" : "Show"} {row.options.length} account options
                    </button>
                  </div>

                  <div className="selected-editor">
                    <span className="selected-label">
                      Selected{selectedOpt ? ` · ${selectedOpt.accountName}` : ""}:
                    </span>
                    <input
                      className={`selected-input${ev.valid ? "" : " over"}`}
                      value={row.selectedTitle}
                      onChange={(e) => editSelectedTitle(row.rowId, e.target.value)}
                      placeholder="Select or edit a title"
                    />
                    <CopyButton text={row.selectedTitle} />
                  </div>
                  <div className="title-meta">
                    <StatusBadge status={ev.status} />
                    {!ev.valid && <RiskBadge risk="CHECK" />}
                    <CharCount count={ev.characterCount} max={MAX_LENGTH} />
                    {!ev.valid && <span className="note-inline">Needs manual shortening</span>}
                  </div>

                  {isOpen && (
                    <ul className="option-list">
                      {row.options.map((opt) => (
                        <li key={opt.accountId} className={`option-item${opt.valid ? "" : " invalid"}`}>
                          <label className="option-pick">
                            <input
                              type="radio"
                              name={`sel-${row.rowId}`}
                              checked={row.selectedAccountId === opt.accountId}
                              onChange={() => selectOption(row.rowId, opt.accountId, opt.title)}
                            />
                            <span className="account-name">{opt.accountName}</span>
                          </label>
                          <span className="option-title">{opt.title}</span>
                          <span className="option-meta">
                            <StatusBadge status={opt.status} />
                            <RiskBadge risk={opt.riskFlag} />
                            <CharCount count={opt.characterCount} max={MAX_LENGTH} />
                            <CopyButton text={opt.title} />
                          </span>
                          {opt.notes && <span className="note-inline">{opt.notes}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {rows.length === 0 && !parseWarning && (
        <p className="placeholder">
          Upload a CSV (or load the sample) to generate per-account title options for every row.
        </p>
      )}
    </section>
  );
}
