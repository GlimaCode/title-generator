// ---------------------------------------------------------------------------
// Autocomplete — a text input with a compact, keyboard-accessible suggestion
// dropdown driven by the spreadsheet catalog.
//
// Behavior:
//   - suggestions update on every keystroke (case-insensitive)
//   - ranked: exact match > starts-with > contains; max MAX_SUGGESTIONS shown
//   - ArrowUp/ArrowDown navigate, Enter selects, Escape closes,
//     click outside closes, clicking a suggestion selects it
//   - typing freely is always allowed (manual values are preserved);
//     selecting stores the canonical catalog value
//   - the dropdown never opens for an empty field unless the user presses
//     ArrowDown to browse explicitly
//   - only the (<= MAX_SUGGESTIONS) visible items are rendered in the DOM
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";

const MAX_SUGGESTIONS = 8;

/**
 * Matching-only normalization: case-insensitive, hyphens treated as spaces,
 * repeated/leading/trailing spaces collapsed — so "mercedes benz" finds the
 * canonical "Mercedes-Benz". The stored/displayed value stays canonical.
 */
function norm(s: string): string {
  return s.toLowerCase().replace(/[-\s]+/g, " ").trim();
}

/** Rank options against a query: exact (0) > starts-with (1) > contains (2). */
function filterOptions(options: string[], query: string): string[] {
  const q = norm(query);
  if (!q) return options.slice(0, MAX_SUGGESTIONS);
  const exact: string[] = [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const o of options) {
    const l = norm(o);
    if (l === q) exact.push(o);
    else if (l.startsWith(q)) starts.push(o);
    else if (l.includes(q)) contains.push(o);
    // Stop scanning once every bucket is already overfull.
    if (exact.length + starts.length >= MAX_SUGGESTIONS && starts.length >= MAX_SUGGESTIONS) break;
  }
  return [...exact, ...starts, ...contains].slice(0, MAX_SUGGESTIONS);
}

/** Bold the matched part of a suggestion (simple, theme-friendly highlight). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  // Hyphen/space tolerant: each gap in the query matches "-" or spaces in the text.
  const pattern = q
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[-\\s]+");
  const m = pattern ? new RegExp(pattern, "i").exec(text) : null;
  if (!m) return <>{text}</>;
  const at = m.index;
  return (
    <>
      {text.slice(0, at)}
      <strong>{text.slice(at, at + m[0].length)}</strong>
      {text.slice(at + m[0].length)}
    </>
  );
}

export interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  ariaLabel?: string;
  /** Shown instead of suggestions when the source list is empty (e.g. "Select a make first"). */
  emptyHint?: string;
}

export function Autocomplete({ value, onChange, options, placeholder, ariaLabel, emptyHint }: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => filterOptions(options, value), [options, value]);
  const showHint = open && options.length === 0 && !!emptyHint;
  const showList = open && filtered.length > 0 && options.length > 0;

  // Close when clicking anywhere outside the component.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const select = (v: string) => {
    onChange(v); // canonical catalog value
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true); // explicit open (also works on an empty field)
        setActive(0);
      } else {
        setActive((i) => (filtered.length ? (i + 1) % filtered.length : -1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open) setActive((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : -1));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && active < filtered.length) {
        e.preventDefault();
        select(filtered[active]);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div className="ac-wrap" ref={wrapRef}>
      <input
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(e.target.value.trim().length > 0); // never auto-open when empty
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (value.trim()) setOpen(true);
        }}
      />
      {showList && (
        <ul className="ac-list" role="listbox">
          {filtered.map((o, i) => (
            <li
              key={o}
              role="option"
              aria-selected={i === active}
              className={`ac-item${i === active ? " active" : ""}`}
              // mousedown (not click) so selection wins over the outside-close handler
              onMouseDown={(e) => {
                e.preventDefault();
                select(o);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <Highlight text={o} query={value} />
            </li>
          ))}
        </ul>
      )}
      {showHint && <div className="ac-list ac-hint">{emptyHint}</div>}
    </div>
  );
}
