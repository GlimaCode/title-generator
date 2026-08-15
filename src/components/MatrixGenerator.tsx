// ---------------------------------------------------------------------------
// Variation Matrix — enter a vehicle/product base once, pick one or more
// accounts, then generate the 9 main variations (and any custom variations)
// INSIDE each selected account. Results are grouped by account.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type {
  AccountBlock,
  AccountConfig,
  FitmentWord,
  HistoryRecord,
  MatrixBaseInput,
  MatrixTitle,
  MatrixTitleRef,
  ProductWording,
  VariationConfig,
} from "../types";
import { evaluateTitle, MAX_LENGTH } from "../titleGenerator";
import { MAIN_VARIATIONS, CUSTOM_VARIATIONS } from "../config/variations";
import { buildAccountBlocks, buildMatrixCsv, countBlocks } from "../lib/matrix";
import { downloadText } from "../lib/download";
import { CharCount, CopyButton, Field, RiskBadge, StatusBadge } from "./ui";
import { Autocomplete } from "./Autocomplete";
import {
  CATALOG_FACTORY_COLORS,
  CATALOG_MAKES,
  CATALOG_MATERIALS,
  CATALOG_VARIATIONS,
  isKnownMake,
  modelBelongsToMake,
  modelsForMake,
} from "../lib/catalogLookup";

const FITMENT_OPTIONS: FitmentWord[] = ["Fits", "For"];
const PRODUCT_OPTIONS: ProductWording[] = [
  "Seat Cover",
  "Cover",
  "Replacement Cover",
  "Upholstery Cover",
  "Bottom Cover",
  "Top Cover",
];

const EMPTY_BASE: MatrixBaseInput = {
  yearRange: "",
  make: "",
  model: "",
  material: "",
  color: "",
  fitment: "Fits",
  productType: "Seat Cover",
  additionalVariation: "",
  notes: "",
  groupName: "",
};

const REQUIRED: { key: keyof MatrixBaseInput; label: string }[] = [
  { key: "yearRange", label: "Year Range" },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "material", label: "Material" },
  { key: "color", label: "Color" },
];

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

// --- One variation row inside an account (inline editable) ------------------

function VariationRow({ t, onEdit }: { t: MatrixTitle; onEdit: (value: string) => void }) {
  const ev = evaluateTitle(t.editedTitle);
  const isEdited = t.editedTitle !== t.title;
  // Show the generator's notes (uniqueness / preservation / shortening) even when
  // over 80, and add "Manually edited" when the user changed the title.
  const baseNote = t.notes || (!ev.valid ? "Needs manual shortening" : "");
  const noteText = isEdited ? (baseNote ? `${baseNote}; Manually edited` : "Manually edited") : baseNote;
  const flagged = !ev.valid || t.riskFlag === "CHECK";
  return (
    <li className={`vm-row${ev.valid ? "" : " invalid"}`}>
      <span className="vm-var-name">{t.variationName}</span>
      <input
        className={`vm-input${ev.valid ? "" : " over"}`}
        value={t.editedTitle}
        onChange={(e) => onEdit(e.target.value)}
        aria-label={t.variationName}
      />
      <span className="vm-meta">
        <StatusBadge status={ev.status} />
        {flagged && <RiskBadge risk="CHECK" />}
        <CharCount count={ev.characterCount} max={MAX_LENGTH} />
        <CopyButton text={t.editedTitle} />
      </span>
      {noteText && <span className="note-inline">{noteText}</span>}
    </li>
  );
}

// --- One account block (collapsible) ---------------------------------------

function AccountCard({
  block,
  open,
  onToggle,
  onEdit,
  onCopy,
  copied,
}: {
  block: AccountBlock;
  open: boolean;
  onToggle: () => void;
  onEdit: (variationId: string, value: string) => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const validCount = block.titles.filter((t) => evaluateTitle(t.editedTitle).valid).length;
  return (
    <div className="vm-group">
      <button type="button" className="vm-group-head" onClick={onToggle}>
        <span className={`vm-caret${open ? " open" : ""}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
        <span className="vm-group-name">{block.accountName}</span>
        <span className="vm-group-count">{validCount}/{block.titles.length} valid</span>
      </button>
      {open && (
        <div className="vm-group-body">
          <div className="vm-group-actions">
            <button type="button" className="link-btn" onClick={onCopy}>
              {copied ? "✓ Copied account" : "Copy all in account"}
            </button>
          </div>
          <ul className="vm-rows">
            {block.titles.map((t) => (
              <VariationRow key={t.variationId} t={t} onEdit={(v) => onEdit(t.variationId, v)} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// --- Main component --------------------------------------------------------

interface Props {
  accounts: AccountConfig[];
  onSave: (record: HistoryRecord) => void;
  restored: { base: MatrixBaseInput; mainBlocks: AccountBlock[]; customBlocks: AccountBlock[] } | null;
  /** Publishes the latest generated titles (for the SEO tab to pick from). */
  onResults?: (titles: MatrixTitleRef[]) => void;
}

/** Flatten account blocks into title refs (with account info) for the SEO selector. */
function flattenTitles(...groups: (AccountBlock[] | null)[]): MatrixTitleRef[] {
  const out: MatrixTitleRef[] = [];
  for (const blocks of groups) {
    for (const b of blocks ?? []) {
      for (const t of b.titles) {
        out.push({
          accountId: b.accountId,
          accountName: b.accountName,
          variationName: t.variationName,
          label: `${b.accountName} · ${t.variationName}`,
          title: t.editedTitle,
        });
      }
    }
  }
  return out;
}

export function MatrixGenerator({ accounts, onSave, restored, onResults }: Props) {
  const [base, setBase] = useState<MatrixBaseInput>(EMPTY_BASE);
  const [includeAdditional, setIncludeAdditional] = useState(false);
  const [useFits, setUseFits] = useState(true);
  const [missing, setMissing] = useState<string[]>([]);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.enabled), [accounts]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
    () => new Set(accounts.filter((a) => a.enabled).map((a) => a.id)),
  );

  const [mainBlocks, setMainBlocks] = useState<AccountBlock[] | null>(null);
  const [customBlocks, setCustomBlocks] = useState<AccountBlock[] | null>(null);
  const [usedBase, setUsedBase] = useState<MatrixBaseInput>(EMPTY_BASE);

  const [openMain, setOpenMain] = useState<Set<string>>(new Set());
  const [openCustom, setOpenCustom] = useState<Set<string>>(new Set());
  const [copiedAcct, setCopiedAcct] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [saved, setSaved] = useState(false);

  // Custom variation picker
  const [customSearch, setCustomSearch] = useState("");
  const [customSelected, setCustomSelected] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState("");
  const [customTyped, setCustomTyped] = useState<string[]>([]);

  // Reopen from history.
  useEffect(() => {
    if (restored) {
      setBase(restored.base);
      setUsedBase(restored.base);
      setMainBlocks(restored.mainBlocks.length ? restored.mainBlocks : null);
      setCustomBlocks(restored.customBlocks.length ? restored.customBlocks : null);
      setIncludeAdditional(restored.base.additionalVariation.trim().length > 0);
      const ids = new Set<string>([
        ...restored.mainBlocks.map((b) => b.accountId),
        ...restored.customBlocks.map((b) => b.accountId),
      ]);
      if (ids.size) setSelectedAccountIds(ids);
      setOpenMain(new Set());
      setOpenCustom(new Set());
    }
  }, [restored]);

  // "Use Fits when possible" prefers Fits for every account (the engine still
  // falls back to "For" automatically when a title is too long).
  const effectiveAccounts = useMemo(
    () => (useFits ? accounts.map((a) => ({ ...a, preferredFitmentWord: "Fits" as FitmentWord })) : accounts),
    [accounts, useFits],
  );

  const update = <K extends keyof MatrixBaseInput>(key: K, value: MatrixBaseInput[K]) =>
    setBase((b) => ({ ...b, [key]: value }));

  // Make/Model dependency: when the make changes to a KNOWN catalog make and
  // the current model does not belong to it, clear the model (no invalid
  // make/model combinations). Unknown (manually typed) makes leave the model
  // untouched — manual values stay allowed.
  const updateMake = (value: string) =>
    setBase((b) => ({
      ...b,
      make: value,
      model:
        b.model.trim() && isKnownMake(value) && !modelBelongsToMake(value, b.model) ? "" : b.model,
    }));

  const modelOptions = modelsForMake(base.make);

  const effectiveBase = (): MatrixBaseInput => ({
    ...base,
    additionalVariation: includeAdditional ? base.additionalVariation : "",
  });

  const selectedAccounts = (): AccountConfig[] =>
    effectiveAccounts.filter((a) => a.enabled && selectedAccountIds.has(a.id));

  const validate = (): boolean => {
    const m = REQUIRED.filter(({ key }) => String(base[key]).trim().length === 0).map(({ label }) => label);
    if (selectedAccountIds.size === 0) m.push("Select at least one account");
    setMissing(m);
    return m.length === 0;
  };

  const handleGenerateMain = () => {
    if (!validate()) return;
    const eb = effectiveBase();
    setUsedBase(eb);
    const blocks = buildAccountBlocks(eb, MAIN_VARIATIONS, selectedAccounts());
    setMainBlocks(blocks);
    setOpenMain(new Set());
    onResults?.(flattenTitles(blocks, customBlocks));
  };

  const handleGenerateCustom = () => {
    if (!validate()) return;
    const selectedConfigs = CUSTOM_VARIATIONS.filter((v) => customSelected.has(v.id));
    const typedConfigs: VariationConfig[] = customTyped.map((label, i) => ({
      id: `typed-${i}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label,
      type: "custom",
      enabled: true,
      sortOrder: 1000 + i,
    }));
    const list = [...selectedConfigs, ...typedConfigs];
    if (list.length === 0) {
      setMissing(["Select or type at least one custom variation"]);
      return;
    }
    const eb = effectiveBase();
    setUsedBase(eb);
    const blocks = buildAccountBlocks(eb, list, selectedAccounts());
    setCustomBlocks(blocks);
    setOpenCustom(new Set());
    onResults?.(flattenTitles(mainBlocks, blocks));
  };

  const handleClear = () => {
    setBase(EMPTY_BASE);
    setMainBlocks(null);
    setCustomBlocks(null);
    setMissing([]);
    setCustomSelected(new Set());
    setCustomTyped([]);
    setCustomText("");
  };

  // --- mutation helpers ---
  const editTitle = (
    setter: Dispatch<SetStateAction<AccountBlock[] | null>>,
    accountId: string,
    variationId: string,
    value: string,
  ) => {
    setter((prev) =>
      prev
        ? prev.map((b) =>
            b.accountId === accountId
              ? { ...b, titles: b.titles.map((t) => (t.variationId === variationId ? { ...t, editedTitle: value } : t)) }
              : b,
          )
        : prev,
    );
  };

  const toggle = (setter: Dispatch<SetStateAction<Set<string>>>, id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const copyAccount = async (block: AccountBlock) => {
    await copyToClipboard(block.titles.map((t) => t.editedTitle).join("\n"));
    setCopiedAcct(block.accountId);
    window.setTimeout(() => setCopiedAcct(null), 1500);
  };

  const copyAllValidMain = async () => {
    if (!mainBlocks) return;
    const lines = mainBlocks.flatMap((b) =>
      b.titles.filter((t) => evaluateTitle(t.editedTitle).valid).map((t) => t.editedTitle),
    );
    await copyToClipboard(lines.join("\n"));
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 1600);
  };

  const handleSaveHistory = () => {
    if (!mainBlocks && !customBlocks) return;
    const all = [...(mainBlocks ?? []), ...(customBlocks ?? [])];
    const counts = countBlocks(all);
    const snapAccounts = selectedAccounts();
    const record: HistoryRecord = {
      id: `hist-${Date.now()}`,
      kind: "matrix",
      dateTime: new Date().toLocaleString(),
      validCount: counts.valid,
      nearLimitCount: counts.near,
      tooLongCount: counts.tooLong,
      accountsSnapshot: snapAccounts.map((a) => ({ id: a.id, name: a.name, styleId: a.styleId })),
      base: usedBase,
      mainBlocks: mainBlocks ?? [],
      customBlocks: customBlocks ?? [],
    };
    onSave(record);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const mainVarCount = MAIN_VARIATIONS.filter((v) => v.enabled).length;
  const expectedTotal = mainVarCount * selectedAccountIds.size;
  const filteredCustom = CUSTOM_VARIATIONS.filter((v) => v.label.toLowerCase().includes(customSearch.toLowerCase()));

  return (
    <div>
      {/* ------------------------- 1. Base form ------------------------- */}
      <section className="card" aria-label="Vehicle base details">
        <h2 className="card-title"><span className="step-num">1</span> Vehicle / Product Base</h2>
        <div className="form-grid">
          <Field label="Year Range" required>
            <input value={base.yearRange} onChange={(e) => update("yearRange", e.target.value)} placeholder="2000-2010" />
          </Field>
          <Field label="Make" required>
            <Autocomplete
              value={base.make}
              onChange={updateMake}
              options={CATALOG_MAKES}
              placeholder="Chevy"
              ariaLabel="Make"
            />
          </Field>
          <Field label="Model" required>
            <Autocomplete
              value={base.model}
              onChange={(v) => update("model", v)}
              options={modelOptions}
              placeholder="Silverado 1500"
              ariaLabel="Model"
              emptyHint="Select a make first"
            />
          </Field>
          <Field label="Material" required>
            <Autocomplete
              value={base.material}
              onChange={(v) => update("material", v)}
              options={CATALOG_MATERIALS}
              placeholder="Genuine Leather"
              ariaLabel="Material"
            />
          </Field>
          <Field label="Color" required hint="factory color">
            <Autocomplete
              value={base.color}
              onChange={(v) => update("color", v)}
              options={CATALOG_FACTORY_COLORS}
              placeholder="Tan"
              ariaLabel="Color"
            />
          </Field>
          <Field label="Fitment" hint="auto-falls back to For">
            <select value={base.fitment} onChange={(e) => update("fitment", e.target.value as FitmentWord)}>
              {FITMENT_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Product Type" hint="accounts may override">
            <select value={base.productType} onChange={(e) => update("productType", e.target.value as ProductWording)}>
              {PRODUCT_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Brand / Vehicle Group" hint="optional">
            <input value={base.groupName} onChange={(e) => update("groupName", e.target.value)} placeholder="optional note" />
          </Field>
          {includeAdditional && (
            <Field label="Additional Variation" hint="optional">
              <Autocomplete
                value={base.additionalVariation}
                onChange={(v) => update("additionalVariation", v)}
                options={CATALOG_VARIATIONS}
                placeholder="Perforated"
                ariaLabel="Additional Variation"
              />
            </Field>
          )}
          <Field label="Session Notes" hint="optional">
            <input value={base.notes} onChange={(e) => update("notes", e.target.value)} placeholder="optional" />
          </Field>
        </div>
        <div className="vm-toggles">
          <label className="toggle">
            <input type="checkbox" checked={includeAdditional} onChange={(e) => setIncludeAdditional(e.target.checked)} />
            <span>Include Additional Variation Field</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={useFits} onChange={(e) => setUseFits(e.target.checked)} />
            <span>Use “Fits” when possible</span>
          </label>
        </div>
      </section>

      {/* --------------------- 2. Account selection --------------------- */}
      <section className="card" aria-label="Account selection">
        <div className="results-head">
          <h2 className="card-title"><span className="step-num">2</span> Select Accounts</h2>
          <span className="results-count">{selectedAccountIds.size} of {activeAccounts.length} selected</span>
        </div>
        <div className="results-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedAccountIds(new Set(activeAccounts.map((a) => a.id)))}>
            Select All Accounts
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedAccountIds(new Set())}>
            Clear Selection
          </button>
        </div>
        <div className="custom-checklist account-select">
          {activeAccounts.map((a) => (
            <label key={a.id} className={`custom-option${selectedAccountIds.has(a.id) ? " on" : ""}`}>
              <input type="checkbox" checked={selectedAccountIds.has(a.id)} onChange={() => toggle(setSelectedAccountIds, a.id)} />
              <span>{a.name}</span>
            </label>
          ))}
          {activeAccounts.length === 0 && <span className="muted-hint">No active accounts — enable some in Account Settings.</span>}
        </div>

        {missing.length > 0 && (
          <div className="warning" role="alert">
            <strong>Please complete:</strong> {missing.join(", ")}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={handleGenerateMain}>
            Generate Main 9 Variations
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleClear}>
            Clear
          </button>
        </div>
        <p className="muted-hint">
          {mainVarCount} main variations × {selectedAccountIds.size} selected accounts = <strong>{expectedTotal}</strong> titles.
        </p>
      </section>

      {/* ----------------- 3. Main results (by account) ----------------- */}
      {mainBlocks && (
        <section className="card" aria-label="Main variation results">
          <div className="results-head">
            <h2 className="card-title"><span className="step-num">3</span> Review Titles — by Account</h2>
            <span className="results-count">{mainBlocks.reduce((s, b) => s + b.titles.length, 0)} titles</span>
          </div>
          <div className="results-actions">
            <button type="button" className="btn btn-secondary" onClick={copyAllValidMain}>
              {copiedAll ? "✓ Copied" : "Copy All Valid (Selected Accounts)"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => downloadText("variation-matrix-main9.csv", buildMatrixCsv(mainBlocks, usedBase))}>
              Export Main 9 Titles
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleSaveHistory}>
              {saved ? "✓ Saved to History" : "Save to History"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenMain(new Set(mainBlocks.map((b) => b.accountId)))}>
              Expand All
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenMain(new Set())}>
              Collapse All
            </button>
          </div>
          <div className="vm-groups">
            {mainBlocks.map((b) => (
              <AccountCard
                key={b.accountId}
                block={b}
                open={openMain.has(b.accountId)}
                onToggle={() => toggle(setOpenMain, b.accountId)}
                onEdit={(varId, v) => editTitle(setMainBlocks, b.accountId, varId, v)}
                onCopy={() => copyAccount(b)}
                copied={copiedAcct === b.accountId}
              />
            ))}
          </div>
        </section>
      )}

      {/* ----------------- 4. Custom / additional variations ----------------- */}
      <section className="card" aria-label="Custom variations">
        <h2 className="card-title">Custom / Additional Variations</h2>
        <p className="muted-hint">
          Pick from {CUSTOM_VARIATIONS.length} additional variations (or type your own), then generate titles for the
          selected accounts. The main 9 are not affected.
        </p>
        <div className="custom-picker">
          <input className="custom-search" value={customSearch} onChange={(e) => setCustomSearch(e.target.value)} placeholder="Search variations…" />
          <div className="custom-checklist">
            {filteredCustom.map((v) => (
              <label key={v.id} className={`custom-option${customSelected.has(v.id) ? " on" : ""}`}>
                <input type="checkbox" checked={customSelected.has(v.id)} onChange={() => toggle(setCustomSelected, v.id)} />
                <span>{v.label}</span>
              </label>
            ))}
            {filteredCustom.length === 0 && <span className="muted-hint">No matches.</span>}
          </div>
          <div className="custom-add">
            <input
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Type a custom variation and Add"
              onKeyDown={(e) => {
                if (e.key === "Enter" && customText.trim()) {
                  setCustomTyped((p) => [...p, customText.trim()]);
                  setCustomText("");
                }
              }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (customText.trim()) {
                  setCustomTyped((p) => [...p, customText.trim()]);
                  setCustomText("");
                }
              }}
            >
              Add
            </button>
          </div>
          {customTyped.length > 0 && (
            <div className="custom-typed">
              {customTyped.map((label, i) => (
                <span key={`${label}-${i}`} className="account-chip">
                  {label}
                  <button type="button" className="chip-x" onClick={() => setCustomTyped((p) => p.filter((_, idx) => idx !== i))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={handleGenerateCustom}>
            Generate Custom Variation Titles
          </button>
          {customBlocks && (
            <button type="button" className="btn btn-secondary" onClick={() => downloadText("variation-matrix-custom.csv", buildMatrixCsv(customBlocks, usedBase))}>
              Export Custom Variation Titles
            </button>
          )}
        </div>

        {customBlocks && (
          <div className="vm-groups">
            {customBlocks.map((b) => (
              <AccountCard
                key={b.accountId}
                block={b}
                open={openCustom.has(b.accountId)}
                onToggle={() => toggle(setOpenCustom, b.accountId)}
                onEdit={(varId, v) => editTitle(setCustomBlocks, b.accountId, varId, v)}
                onCopy={() => copyAccount(b)}
                copied={copiedAcct === b.accountId}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
