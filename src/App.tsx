// ---------------------------------------------------------------------------
// Seat Cover Title Batch Generator — app shell + shared state.
// Sections: Variation Matrix (default), CSV Batch Processor, History, Account
// Settings, Rules Summary. Account config, history, and theme persist in
// localStorage.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import type { AccountBlock, AccountConfig, BatchRow, ConvertedRow, HistoryRecord, MatrixBaseInput, MatrixTitleRef } from "./types";
import { loadAccounts, saveAccounts, resetAccounts, loadHistory, saveHistory } from "./lib/storage";
import { MatrixGenerator } from "./components/MatrixGenerator";
import { SeoPanel } from "./components/SeoPanel";
import { BatchProcessor } from "./components/BatchProcessor";
import { TitleConverter } from "./components/TitleConverter";
import { HistoryPanel } from "./components/HistoryPanel";
import { AccountSettings } from "./components/AccountSettings";
import { RulesSummary } from "./components/RulesSummary";

type Tab = "matrix" | "seo" | "batch" | "convert" | "history" | "accounts" | "rules";

// Navbar tabs (the older general "CSV Batch Processor" is intentionally hidden
// from the navbar to avoid duplicate CSV tabs; its view still renders if a
// legacy batch history record is reopened).
const TABS: { id: Tab; label: string }[] = [
  { id: "matrix", label: "Variation Matrix" },
  { id: "seo", label: "SEO" },
  { id: "convert", label: "CSV Account Title Generator" },
  { id: "history", label: "History" },
  { id: "accounts", label: "Account Settings" },
  { id: "rules", label: "Rules Summary" },
];

type Theme = "light" | "dark";
const THEME_KEY = "sctg.theme";

function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

type RestoredMatrix = { base: MatrixBaseInput; mainBlocks: AccountBlock[]; customBlocks: AccountBlock[] };
type RestoredConvert = { fileName: string; selectedAccount: string; rows: ConvertedRow[] };

export default function App() {
  const [tab, setTab] = useState<Tab>("matrix");
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [accounts, setAccounts] = useState<AccountConfig[]>(() => loadAccounts());
  const [history, setHistory] = useState<HistoryRecord[]>(() => loadHistory());
  const [restoredBatch, setRestoredBatch] = useState<{ fileName: string; rows: BatchRow[] } | null>(null);
  const [restoredMatrix, setRestoredMatrix] = useState<RestoredMatrix | null>(null);
  const [restoredConvert, setRestoredConvert] = useState<RestoredConvert | null>(null);
  const [matrixTitles, setMatrixTitles] = useState<MatrixTitleRef[]>([]);

  // Persist on change.
  useEffect(() => saveAccounts(accounts), [accounts]);
  useEffect(() => saveHistory(history), [history]);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const activeCount = accounts.filter((a) => a.enabled).length;

  const handleSaveHistory = (record: HistoryRecord) => {
    setHistory((prev) => [record, ...prev]);
  };

  const handleReopen = (record: HistoryRecord) => {
    // New object identity each time so the target section reloads it.
    if (record.kind === "matrix") {
      setRestoredMatrix({
        base: record.base as MatrixBaseInput,
        mainBlocks: record.mainBlocks ?? [],
        customBlocks: record.customBlocks ?? [],
      });
      setTab("matrix");
    } else if (record.kind === "convert") {
      setRestoredConvert({
        fileName: record.fileName ?? "",
        selectedAccount: record.selectedAccount ?? "",
        rows: record.convertedRows ?? [],
      });
      setTab("convert");
    } else {
      setRestoredBatch({ fileName: record.fileName ?? "", rows: record.rows ?? [] });
      setTab("batch");
    }
  };

  const handleResetAccounts = () => {
    setAccounts(resetAccounts());
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 11V6a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3v5" />
                <path d="M5 11h9a4 4 0 0 1 4 4v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
                <path d="M5 16H4a2 2 0 0 0 0 4h1" />
              </svg>
            </span>
            <div className="app-header-text">
              <h1>Seat Cover Title Generator</h1>
              <p>eBay title generation per account — all under 80 characters. 100% local · no AI.</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            )}
          </button>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "history" && history.length > 0 && <span className="tab-badge">{history.length}</span>}
              {t.id === "accounts" && <span className="tab-badge">{activeCount}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        {/* Variation Matrix stays mounted (hidden when inactive) so its form,
            account selection, generated results, and edits persist across tab
            switches for the current session — no localStorage drafts. */}
        <div style={{ display: tab === "matrix" ? undefined : "none" }}>
          <MatrixGenerator accounts={accounts} onSave={handleSaveHistory} restored={restoredMatrix} onResults={setMatrixTitles} />
        </div>
        {tab === "seo" && <SeoPanel accounts={accounts} matrixTitles={matrixTitles} />}
        {tab === "batch" && <BatchProcessor accounts={accounts} onSave={handleSaveHistory} restored={restoredBatch} />}
        {tab === "convert" && <TitleConverter accounts={accounts} onSave={handleSaveHistory} restored={restoredConvert} />}
        {tab === "history" && (
          <HistoryPanel
            records={history}
            onReopen={handleReopen}
            onDelete={(id) => setHistory((prev) => prev.filter((r) => r.id !== id))}
            onClearAll={() => setHistory([])}
          />
        )}
        {tab === "accounts" && (
          <AccountSettings accounts={accounts} onChange={setAccounts} onReset={handleResetAccounts} />
        )}
        {tab === "rules" && <RulesSummary accounts={accounts} />}
      </main>

      <footer className="app-footer">
        <span>≤70 Good · 71–75 Safe · 76–80 Near Limit · &gt;80 Too Long (flagged CHECK). One title per active account.</span>
        <span className="footer-credit">Built by <strong>GlimaCode</strong></span>
      </footer>
    </div>
  );
}
