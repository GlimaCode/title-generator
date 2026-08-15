// ---------------------------------------------------------------------------
// CSV Account Title Generator — upload titles, pick an account style, rewrite
// every title, then download two outputs: confident "Converted Titles" and
// uncertain "Manual Check Titles". Clean, stepped, focused UI.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import type { AccountConfig, ConvertedRow, HistoryRecord } from "../types";
import { evaluateTitle, MAX_LENGTH } from "../titleGenerator";
import {
  buildConvertedCsv,
  buildManualCheckCsv,
  convertAll,
  parseConverterCsv,
  type ConverterInputRow,
} from "../lib/converter";
import { downloadText } from "../lib/download";
import { CharCount, CopyButton, RiskBadge, StatusBadge } from "./ui";

interface Props {
  accounts: AccountConfig[];
  onSave: (record: HistoryRecord) => void;
  restored: { fileName: string; selectedAccount: string; rows: ConvertedRow[] } | null;
}

export function TitleConverter({ accounts, onSave, restored }: Props) {
  const activeAccounts = useMemo(() => accounts.filter((a) => a.enabled), [accounts]);
  const [accountId, setAccountId] = useState<string>(() => activeAccounts[0]?.id ?? "");
  const [input, setInput] = useState<ConverterInputRow[]>([]);
  const [rows, setRows] = useState<ConvertedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (restored) {
      setFileName(restored.fileName);
      setRows(restored.rows);
      setInput(restored.rows.map((r) => ({ itemId: r.itemId, title: r.oldTitle })));
      const match = activeAccounts.find((a) => a.name === restored.selectedAccount);
      if (match) setAccountId(match.id);
      setWarning(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  useEffect(() => {
    if (!activeAccounts.some((a) => a.id === accountId) && activeAccounts[0]) {
      setAccountId(activeAccounts[0].id);
    }
  }, [activeAccounts, accountId]);

  const selectedAccount = activeAccounts.find((a) => a.id === accountId) ?? null;

  const stats = useMemo(() => {
    const list = rows ?? [];
    let converted = 0;
    let manual = 0;
    let near = 0;
    let tooLong = 0;
    for (const r of list) {
      if (r.needsManualCheck) manual++;
      else converted++;
      const ev = evaluateTitle(r.newTitle);
      if (ev.status === "Near Limit") near++;
      if (ev.status === "Too Long") tooLong++;
    }
    return { total: list.length, converted, manual, near, tooLong };
  }, [rows]);

  const loadCsvText = (text: string, name: string) => {
    const { rows: parsed, hasTitle } = parseConverterCsv(text);
    if (!hasTitle) {
      setWarning("Couldn't find a “title” column. Your CSV needs item_id and title columns.");
      setInput([]); setRows(null); setFileName(name);
      return;
    }
    if (parsed.length === 0) {
      setWarning("No data rows found in the CSV.");
      setInput([]); setRows(null); setFileName(name);
      return;
    }
    setWarning(null); setInput(parsed); setRows(null); setFileName(name);
  };

  const handleFile = async (file: File) => loadCsvText(await file.text(), file.name);

  const handleConvert = () => {
    if (input.length === 0) { setWarning("Upload a CSV first."); return; }
    if (!selectedAccount) { setWarning("Select an account style."); return; }
    setRows(convertAll(input, selectedAccount));
  };

  const editTitle = (rowId: string, value: string) =>
    setRows((prev) => (prev ? prev.map((r) => (r.rowId === rowId ? { ...r, newTitle: value } : r)) : prev));

  const downloadConverted = () => {
    if (!rows) return;
    downloadText("converted_titles.csv", "﻿" + buildConvertedCsv(rows));
  };
  const downloadManual = () => {
    if (!rows) return;
    downloadText("manual_check_titles.csv", "﻿" + buildManualCheckCsv(rows));
  };

  const handleSaveHistory = () => {
    if (!rows || rows.length === 0 || !selectedAccount) return;
    const record: HistoryRecord = {
      id: `hist-${Date.now()}`,
      kind: "convert",
      dateTime: new Date().toLocaleString(),
      validCount: stats.converted,
      nearLimitCount: stats.near,
      tooLongCount: stats.tooLong,
      accountsSnapshot: [{ id: selectedAccount.id, name: selectedAccount.name, styleId: selectedAccount.styleId }],
      fileName: fileName || "untitled.csv",
      rowsProcessed: rows.length,
      selectedAccount: selectedAccount.name,
      convertedRows: rows,
      convertedCount: stats.converted,
      manualCheckCount: stats.manual,
    };
    onSave(record);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <section className="card" aria-label="CSV account title generator">
      <h2 className="card-title">CSV Account Title Generator</h2>

      {/* Step 1 — Upload */}
      <div className="step-head"><span className="step-num">1</span> Upload CSV</div>
      <p className="muted-hint" style={{ marginTop: 0 }}>Upload a CSV with <code>item_id</code> and <code>title</code> columns.</p>
      <div className="converter-upload">
        <label className="btn btn-primary file-btn">
          Choose CSV File
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
          />
        </label>
        {fileName ? <span className="file-name">{fileName}{input.length > 0 ? ` · ${input.length} titles` : ""}</span> : <span className="muted-hint" style={{ margin: 0 }}>No file selected</span>}
      </div>

      {/* Step 2 — Select account */}
      <div className="step-head"><span className="step-num">2</span> Select Account Style</div>
      <select
        className="converter-account-select"
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        aria-label="Select account style"
      >
        {activeAccounts.length === 0 && <option value="">No active accounts</option>}
        {activeAccounts.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>

      {/* Step 3 — Convert */}
      <div className="step-head"><span className="step-num">3</span> Convert Titles</div>
      <button type="button" className="btn btn-primary" onClick={handleConvert} disabled={input.length === 0}>
        Convert Titles
      </button>

      {warning && <div className="warning" role="alert">{warning}</div>}

      {rows && rows.length > 0 && (
        <>
          {/* Step 4 — Review */}
          <div className="step-head"><span className="step-num">4</span> Review Results</div>

          <div className="batch-stats">
            <span><strong>{stats.total}</strong> imported</span>
            <span><strong>{stats.converted}</strong> converted</span>
            <span><strong>{stats.manual}</strong> manual check</span>
            <span><strong>{stats.tooLong}</strong> too long</span>
            <span><strong>{stats.near}</strong> near limit</span>
          </div>

          {stats.manual > 0 ? (
            <div className="warning" role="alert">⚠ {stats.manual} row{stats.manual === 1 ? "" : "s"} need manual review before upload.</div>
          ) : (
            <div className="note">No manual check rows found.</div>
          )}

          <div className="batch-rows">
            {rows.map((row) => {
              const ev = evaluateTitle(row.newTitle);
              return (
                <div key={row.rowId} className={`batch-row${row.needsManualCheck ? " review" : ""}`}>
                  <div className="batch-row-head">
                    <div className="batch-row-id">
                      <span className="item-id">#{row.itemId || "—"}</span>
                      <span className="old-title" title={row.oldTitle}>{row.oldTitle}</span>
                    </div>
                    <span className="row-flags">
                      {row.needsManualCheck
                        ? <span className="badge badge-review">Needs Review</span>
                        : <span className="badge badge-ok">OK</span>}
                    </span>
                  </div>

                  <div className="selected-editor">
                    <span className="selected-label">New:</span>
                    <input
                      className={`selected-input${ev.valid ? "" : " over"}`}
                      value={row.newTitle}
                      onChange={(e) => editTitle(row.rowId, e.target.value)}
                      aria-label={`New title for item ${row.itemId}`}
                    />
                    <CopyButton text={row.newTitle} />
                  </div>
                  <div className="title-meta">
                    <StatusBadge status={ev.status} />
                    {row.needsManualCheck && <RiskBadge risk="CHECK" />}
                    <CharCount count={ev.characterCount} max={MAX_LENGTH} />
                    <span className="account-style">{row.accountName}</span>
                    {row.notes && <span className="note-inline">{row.notes}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Step 5 — Download */}
          <div className="step-head"><span className="step-num">5</span> Download Outputs</div>
          <div className="results-actions">
            <button type="button" className="btn btn-secondary" onClick={downloadConverted} disabled={stats.converted === 0}>
              Download Converted Titles ({stats.converted})
            </button>
            <button type="button" className="btn btn-danger" onClick={downloadManual} disabled={stats.manual === 0}>
              Download Manual Check Titles ({stats.manual})
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleSaveHistory}>
              {saved ? "✓ Saved to History" : "Save to History"}
            </button>
          </div>
        </>
      )}

      {!rows && !warning && (
        <p className="placeholder">Upload a CSV and choose an account to convert titles.</p>
      )}
    </section>
  );
}
