"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import type { SearchHit } from "@/features/search/search.service";
import type { NavGroup } from "./nav";

interface Row { key: string; title: string; meta: string; href: string; group: string }

export default function CommandPalette({
  groups, onClose,
}: { groups: NavGroup[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // debounce, and drop responses that arrive after a newer keystroke
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setBusy(false); return; }
    setBusy(true);
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const data = res.ok ? ((await res.json()) as SearchHit[]) : [];
        if (!stale) setHits(data);
      } catch {
        if (!stale) setHits([]);
      } finally {
        if (!stale) setBusy(false);
      }
    }, 180);
    return () => { stale = true; clearTimeout(t); };
  }, [q]);

  // navigation entries are matched locally so jumping to a page never waits
  const pages: Row[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const all = groups.flatMap((g) =>
      g.items.map((i) => ({ key: `nav:${i.href}`, title: i.label, meta: g.label, href: i.href, group: "Go to" }))
    );
    return term ? all.filter((p) => p.title.toLowerCase().includes(term)) : all;
  }, [groups, q]);

  const rows: Row[] = useMemo(() => [
    ...pages,
    ...hits.map((h) => ({ key: h.id + h.group, title: h.title, meta: h.meta, href: h.href, group: h.group })),
  ], [pages, hits]);

  useEffect(() => { setCursor(0); }, [rows.length]);

  function go(row: Row) { router.push(row.href); onClose(); }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, rows.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && rows[cursor]) { e.preventDefault(); go(rows[cursor]); }
  }

  // group rows in encounter order, so "Go to" stays first
  const grouped: [string, Row[]][] = [];
  for (const r of rows) {
    const last = grouped[grouped.length - 1];
    if (last && last[0] === r.group) last[1].push(r);
    else grouped.push([r.group, [r]]);
  }

  let index = -1;
  const term = q.trim();

  return (
    <div className="overlay" style={{ alignItems: "flex-start", paddingTop: "12vh" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label="Search">
      <div className="palette" onKeyDown={onKeyDown}>
        <div className="palette-input">
          <Icon name="search" size={17} />
          <input
            ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects, partners and content…"
            aria-label="Search" autoComplete="off" spellCheck={false}
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls="palette-listbox"
            aria-autocomplete="list"
            aria-activedescendant={rows[cursor] ? `palette-opt-${cursor}` : undefined}
          />
          {busy && <span className="faint">Searching…</span>}
        </div>

        {/* the result count has to be spoken; the list itself is scanned by cursor */}
        <p className="sr-only" role="status">
          {term.length < 2
            ? "Type at least two characters to search."
            : busy
              ? "Searching…"
              : `${rows.length} ${rows.length === 1 ? "result" : "results"}.`}
        </p>

        <div className="palette-results" id="palette-listbox" role="listbox" aria-label="Search results">
          {grouped.map(([group, items]) => (
            <div key={group}>
              <div className="palette-group" role="presentation">{group}</div>
              {items.map((r) => {
                index += 1;
                const i = index;
                return (
                  <button
                    key={r.key} type="button"
                    id={`palette-opt-${i}`}
                    role="option"
                    aria-selected={i === cursor}
                    className={`palette-item ${i === cursor ? "active" : ""}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(r)}
                  >
                    <span className="truncate">{r.title}</span>
                    {r.meta && <span className="meta truncate">{r.meta}</span>}
                  </button>
                );
              })}
            </div>
          ))}

          {rows.length === 0 && (
            <div className="empty" style={{ padding: "28px 16px" }}>
              <div className="t">{term.length < 2 ? "Type to search" : "No matches"}</div>
              <div className="d">
                {term.length < 2
                  ? "Find a project, partner or content card by name, or jump to any page."
                  : `Nothing matched “${term}”.`}
              </div>
            </div>
          )}
        </div>

        <div className="palette-foot">
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
