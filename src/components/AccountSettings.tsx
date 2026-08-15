// ---------------------------------------------------------------------------
// Account Settings — view, enable/disable, add, edit, and delete accounts.
// Changes are persisted (localStorage) and immediately drive generation.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { ALL_TOKENS, TOKEN_LABELS, type AccountConfig, type FitmentWord, type ProductWording, type TitleToken } from "../types";
import { defaultMobileTemplate } from "../lib/seoGenerator";

const FITMENT_OPTIONS: FitmentWord[] = ["Fits", "For"];
const PRODUCT_OPTIONS: ProductWording[] = [
  "Seat Cover",
  "Cover",
  "Replacement Cover",
  "Upholstery Cover",
  "Bottom Cover",
  "Top Cover",
];

interface Props {
  accounts: AccountConfig[];
  onChange: (accounts: AccountConfig[]) => void;
  onReset: () => void;
}

/** Parse a comma-separated token string into a validated TitleToken[]. */
function parseStructure(input: string): TitleToken[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is TitleToken => (ALL_TOKENS as string[]).includes(s));
}

export function AccountSettings({ accounts, onChange, onReset }: Props) {
  // Hold the raw structure text per account so users can type freely.
  const [structureText, setStructureText] = useState<Record<string, string>>({});

  const patch = (id: string, changes: Partial<AccountConfig>) => {
    onChange(accounts.map((a) => (a.id === id ? { ...a, ...changes } : a)));
  };

  const remove = (id: string) => {
    onChange(accounts.filter((a) => a.id !== id));
  };

  const addAccount = () => {
    const n = accounts.length + 1;
    const newAccount: AccountConfig = {
      id: `account-${Date.now()}`,
      name: `New Account ${n}`,
      enabled: true,
      styleId: `style-${String(n).padStart(2, "0")}`,
      preferredFitmentWord: "Fits",
      preferredProductWording: "Seat Cover",
      usesVariation: false,
      titleStructure: ["year", "fitment", "make", "model", "position", "material", "productType", "color"],
    };
    onChange([...accounts, newAccount]);
  };

  const activeCount = accounts.filter((a) => a.enabled).length;

  return (
    <section className="card" aria-label="Account settings">
      <div className="results-head">
        <h2 className="card-title">Account Settings</h2>
        <span className="results-count">
          {activeCount} active / {accounts.length} total
        </span>
      </div>

      <p className="muted-hint">
        Each active account produces one title option. Add or edit accounts here — the generator, batch
        processor, and exports update automatically. Allowed structure tokens:{" "}
        <code>{ALL_TOKENS.join(", ")}</code>.
      </p>

      <div className="account-editor-list">
        {accounts.map((a) => (
          <div key={a.id} className={`account-editor${a.enabled ? "" : " disabled"}`}>
            <div className="account-editor-row">
              <label className="toggle">
                <input type="checkbox" checked={a.enabled} onChange={(e) => patch(a.id, { enabled: e.target.checked })} />
                <span>Enabled</span>
              </label>

              <label className="account-field grow">
                <span>Display Name</span>
                <input value={a.name} onChange={(e) => patch(a.id, { name: e.target.value })} />
              </label>

              <label className="account-field">
                <span>Style ID</span>
                <input value={a.styleId} onChange={(e) => patch(a.id, { styleId: e.target.value })} />
              </label>

              <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(a.id)}>
                Delete
              </button>
            </div>

            <div className="account-editor-row">
              <label className="account-field">
                <span>Fitment</span>
                <select value={a.preferredFitmentWord} onChange={(e) => patch(a.id, { preferredFitmentWord: e.target.value as FitmentWord })}>
                  {FITMENT_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>

              <label className="account-field">
                <span>Product Wording</span>
                <select
                  value={a.preferredProductWording}
                  onChange={(e) => patch(a.id, { preferredProductWording: e.target.value as ProductWording | "" })}
                >
                  <option value="">(inherit listing)</option>
                  {PRODUCT_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>

              <label className="toggle">
                <input type="checkbox" checked={a.usesVariation} onChange={(e) => patch(a.id, { usesVariation: e.target.checked })} />
                <span>Uses Variation</span>
              </label>
            </div>

            <div className="account-editor-row">
              <label className="account-field grow">
                <span>Title Style (ordered tokens, comma-separated)</span>
                <input
                  value={structureText[a.id] ?? a.titleStructure.join(", ")}
                  onChange={(e) => {
                    setStructureText((prev) => ({ ...prev, [a.id]: e.target.value }));
                    patch(a.id, { titleStructure: parseStructure(e.target.value) });
                  }}
                />
              </label>
            </div>
            <div className="account-style-preview">
              {a.titleStructure.map((t, i) => (
                <span key={`${t}-${i}`} className="token-chip">
                  {TOKEN_LABELS[t]}
                </span>
              ))}
            </div>

            <div className="account-editor-row">
              <label className="account-field grow">
                <span>Mobile Description Template (SEO)</span>
                <textarea
                  rows={3}
                  value={a.mobileDescription ?? defaultMobileTemplate(a.name)}
                  onChange={(e) => patch(a.id, { mobileDescription: e.target.value })}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={addAccount}>
          + Add Account
        </button>
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          Reset to Defaults
        </button>
      </div>
    </section>
  );
}
