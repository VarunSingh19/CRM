"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";
import { Button, EmptyState } from "./primitives";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  /** Value used for sorting when the cell renders something non-comparable. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  /** Pass both to enable selection checkboxes. */
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  bulkBar?: ReactNode;
  empty?: { title: string; description?: string; action?: ReactNode };
  pageSize?: number;
  toolbar?: ReactNode;
  /** Shown after the row count in the footer, e.g. a total. */
  footNote?: ReactNode;
  /** Row key to reveal on arrival — the table pages to it, highlights it and
   *  scrolls it into view. Used when another screen links to one record. */
  focusKey?: string | null;
}

type Dir = "asc" | "desc";

const EMPTY: ReadonlySet<string> = new Set<string>();

export default function DataTable<T>({
  rows, columns, rowKey, onRowClick, rowActions,
  selected, onSelectedChange, bulkBar, empty, pageSize = 25, toolbar, footNote, focusKey,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<Dir>("asc");
  const [page, setPage] = useState(0);

  const selectable = !!selected && !!onSelectedChange;
  // a concrete set either way, so no code path dereferences an optional prop
  const sel = selected ?? EMPTY;

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const val = (r: T): string | number => {
      if (col.sortValue) return col.sortValue(r);
      const raw = (r as Record<string, unknown>)[col.key];
      return typeof raw === "number" ? raw : String(raw ?? "").toLowerCase();
    };
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return dir === "asc" ? c : -c;
    });
  }, [rows, columns, sortKey, dir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));

  // jump to whichever page holds the focused row, so a deep link never lands
  // the reader on a page that does not contain the record they asked for
  const focusIndex = useMemo(
    () => (focusKey ? sorted.findIndex((r) => rowKey(r) === focusKey) : -1),
    [sorted, focusKey, rowKey]
  );
  useEffect(() => {
    if (focusIndex >= 0) setPage(Math.floor(focusIndex / pageSize));
  }, [focusIndex, pageSize]);

  const current = Math.min(page, pageCount - 1);
  const view = sorted.slice(current * pageSize, current * pageSize + pageSize);

  const focusRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (focusIndex >= 0) {
      focusRow.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focusIndex, current]);

  function toggleSort(key: string) {
    if (sortKey === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setDir("asc"); }
    setPage(0);
  }

  function toggleRow(id: string) {
    if (!onSelectedChange) return;
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectedChange(next);
  }

  const pageIds = view.map(rowKey);
  const allOnPage = selectable && pageIds.length > 0 && pageIds.every((id) => sel.has(id));

  function toggleAll() {
    if (!onSelectedChange) return;
    const next = new Set(sel);
    if (allOnPage) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    onSelectedChange(next);
  }

  if (rows.length === 0 && empty) {
    return (
      <div className="card">
        {toolbar}
        <EmptyState title={empty.title} description={empty.description} action={empty.action} />
      </div>
    );
  }

  return (
    <div className="card">
      {toolbar}
      {selectable && sel.size > 0 && bulkBar && (
        <div className="bulkbar">
          <span>{sel.size} selected</span>
          <div className="spacer" />
          {bulkBar}
          <Button variant="ghost" size="sm" onClick={() => onSelectedChange?.(new Set())}>Clear</Button>
        </div>
      )}
      <div className="tablewrap">
        <table className="dt">
          <thead>
            <tr>
              {selectable && (
                <th className="check">
                  <input type="checkbox" checked={allOnPage} onChange={toggleAll}
                    aria-label="Select all rows on this page" />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={[c.align ?? "", c.sortable ? "sortable" : "", sortKey === c.key ? "sorted" : ""]
                    .filter(Boolean).join(" ")}
                  aria-sort={sortKey === c.key ? (dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  {c.sortable ? (
                    // a real button, so the sort is reachable by keyboard and
                    // announced; the th keeps aria-sort as the state
                    <button type="button" className="th-sort" onClick={() => toggleSort(c.key)}>
                      {c.header}
                      <span className="sort" aria-hidden="true">
                        {sortKey === c.key ? (dir === "asc" ? "▲" : "▼") : "▲"}
                      </span>
                    </button>
                  ) : c.header}
                </th>
              ))}
              {rowActions && <th className="right" style={{ width: 90 }}><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {view.map((row) => {
              const id = rowKey(row);
              return (
                <tr
                  key={id}
                  ref={id === focusKey ? focusRow : undefined}
                  className={[
                    onRowClick ? "clickable" : "",
                    selectable && sel.has(id) ? "selected" : "",
                    id === focusKey ? "focused" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  // a clickable row must also be reachable and activatable by key
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(row); }
                  } : undefined}
                >
                  {selectable && (
                    <td className="check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={sel.has(id)} onChange={() => toggleRow(id)}
                        aria-label="Select row" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={c.align ?? ""}>{c.render(row)}</td>
                  ))}
                  {rowActions && (
                    <td className="right" onClick={(e) => e.stopPropagation()}>
                      <div className="rowactions">{rowActions(row)}</div>
                    </td>
                  )}
                </tr>
              );
            })}
            {view.length === 0 && (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} className="center muted">
                  Nothing matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="tablefoot">
        <span>
          {sorted.length} {sorted.length === 1 ? "record" : "records"}
          {footNote ? <> · {footNote}</> : null}
        </span>
        <div className="spacer" />
        {pageCount > 1 && (
          <div className="pager">
            <Button variant="ghost" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <Icon name="chevronLeft" size={14} />
            </Button>
            <span>Page {current + 1} of {pageCount}</span>
            <Button variant="ghost" size="sm" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
              <Icon name="chevronRight" size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
