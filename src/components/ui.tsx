// ---------------------------------------------------------------------------
// Small reusable UI primitives shared across sections.
// ---------------------------------------------------------------------------

import { useRef, useState, type ReactNode } from "react";
import type { RiskFlag, Status } from "../types";

const STATUS_CLASS: Record<Status, string> = {
  Good: "badge badge-good",
  Safe: "badge badge-safe",
  "Near Limit": "badge badge-near",
  "Too Long": "badge badge-toolong",
};

const IconFlag = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1Z" />
    <path d="M4 22V4" />
  </svg>
);

const IconCopy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export function StatusBadge({ status }: { status: Status }) {
  return <span className={STATUS_CLASS[status]}>{status}</span>;
}

export function RiskBadge({ risk }: { risk: RiskFlag }) {
  if (risk !== "CHECK") return null;
  return (
    <span className="badge badge-risk" title="Needs manual review">
      <IconFlag /> CHECK
    </span>
  );
}

export function CharCount({ count, max = 80 }: { count: number; max?: number }) {
  return (
    <span className={`char-count${count > max ? " over" : ""}`}>
      {count}/{max} chars
    </span>
  );
}

/** Copy-to-clipboard button with a transient "Copied" confirmation. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts where the Clipboard API is blocked.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      className={`copy-btn${copied ? " copied" : ""}`}
      onClick={handleCopy}
      title="Copy title"
      aria-label="Copy title"
    >
      {copied ? (
        <>
          <IconCheck /> Copied
        </>
      ) : (
        <>
          <IconCopy /> {label}
        </>
      )}
    </button>
  );
}

/** Labeled form field wrapper. */
export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required && (
          <span className="req" title="Required">
            {" "}
            *
          </span>
        )}
        {hint && <span className="field-hint"> ({hint})</span>}
      </span>
      {children}
    </label>
  );
}

/** Shared option lists for listing inputs. */
export const POSITION_OPTIONS = [
  "Driver Bottom",
  "Passenger Bottom",
  "Driver Top",
  "Passenger Top",
  "Front Bottom",
  "Rear Bottom",
  "Lean Back",
  "Backrest",
];

export const MATERIAL_OPTIONS = [
  "Genuine Leather",
  "Leatherette",
  "Vinyl",
  "Cloth",
  "Suede",
  "MB-Tex",
  "Synthetic Leather",
];

export const VARIATION_OPTIONS = ["Perforated", "Perf.", "2-Tone", "Insert", "w/ Piping", "w/o Piping"];
