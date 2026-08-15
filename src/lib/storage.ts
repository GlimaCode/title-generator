// ---------------------------------------------------------------------------
// localStorage persistence for batch history and account configuration.
// Everything stays on the user's machine — no backend.
// ---------------------------------------------------------------------------

import type { AccountConfig, HistoryRecord } from "../types";
import { DEFAULT_ACCOUNTS } from "../config/accounts";

const HISTORY_KEY = "sctg.history.v1";
const ACCOUNTS_KEY = "sctg.accounts.v1";

// ----------------------------------------------------------------- History

export function loadHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(records: HistoryRecord[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
  } catch {
    // storage full / unavailable — ignore (app still works in-memory)
  }
}

// ---------------------------------------------------------------- Accounts

/** Load saved account config, or fall back to the defaults from config/accounts.ts. */
export function loadAccounts(): AccountConfig[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return clone(DEFAULT_ACCOUNTS);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as AccountConfig[];
    return clone(DEFAULT_ACCOUNTS);
  } catch {
    return clone(DEFAULT_ACCOUNTS);
  }
}

export function saveAccounts(accounts: AccountConfig[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // ignore
  }
}

/** Reset accounts back to the defaults shipped in config/accounts.ts. */
export function resetAccounts(): AccountConfig[] {
  try {
    localStorage.removeItem(ACCOUNTS_KEY);
  } catch {
    // ignore
  }
  return clone(DEFAULT_ACCOUNTS);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
