"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DataTable, { type Column } from "@/components/ui/DataTable";
import { Badge, Button, PageHead, type Tone } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Overlay";
import { fieldLabel, entrySummary } from "@/features/audit/audit.labels";

export interface AuditRow {
  _id: string;
  createdAt: string;
  actorId?: string;
  actorName: string;
  actorRole: string;
  action: string;
  resource: string;
  resourceId: string;
  projectId: string;
  label: string;
  meta: Record<string, unknown>;
}

const RESOURCES = ["project", "lineItem", "partner", "catalog", "user", "settings", "document", "auth"];

const RESOURCE_LABEL: Record<string, string> = {
  project: "Projects", lineItem: "Content items", partner: "Partners",
  catalog: "Catalog", user: "Users", settings: "Settings",
  document: "Documents", auth: "Sign-in",
};

/** Verb decides the colour: destructive red, additive green, the rest neutral. */
function actionTone(action: string): Tone {
  if (action.endsWith(".failed") || action === "auth.denied") return "bad";
  if (action.includes("delete") || action.includes("deactivate")) return "bad";
  if (action.includes("create")) return "ok";
  if (action === "auth.login") return "ok";
  if (action.includes("update")) return "info";
  return "neutral";
}

function projectIdOf(r: AuditRow): string {
  return r.projectId || (r.resource === "project" ? r.resourceId : "");
}

function when(iso: string): { d: string; t: string } {
  const dt = new Date(iso);
  return {
    d: dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    t: dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function AuditLogView({
  rows, actors, basePath,
}: {
  rows: AuditRow[];
  actors: { id: string; name: string }[];
  basePath: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, startTransition] = useTransition();
  const [open, setOpen] = useState<AuditRow | null>(null);

  // coarse filters re-query the database; free text narrows what came back
  const resource = params.get("resource") ?? "";
  const actorId = params.get("actor") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const [q, setQ] = useState("");

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }));
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      // search the rendered summary, not the raw label, so older entries match too
      [r.actorName, r.action, entrySummary(r.action, r.label, r.meta), r.resourceId]
        .some((v) => (v ?? "").toLowerCase().includes(term)));
  }, [rows, q]);

  const columns: Column<AuditRow>[] = [
    {
      key: "createdAt", header: "When", sortable: true, width: "150px",
      sortValue: (r) => r.createdAt,
      render: (r) => {
        const w = when(r.createdAt);
        return <><div className="nowrap">{w.d}</div><div className="faint nowrap">{w.t}</div></>;
      },
    },
    {
      key: "actorName", header: "Who", sortable: true, width: "170px",
      render: (r) => (
        <>
          <div className="truncate" style={{ fontWeight: 600 }}>{r.actorName || "—"}</div>
          {r.actorRole && <div className="faint">{r.actorRole}</div>}
        </>
      ),
    },
    {
      key: "action", header: "Action", sortable: true, width: "180px",
      render: (r) => <Badge tone={actionTone(r.action)}>{r.action}</Badge>,
    },
    {
      key: "label", header: "What happened",
      render: (r) => <span className="truncate">{entrySummary(r.action, r.label, r.meta)}</span>,
    },
    {
      key: "resourceId", header: "Record", width: "120px",
      render: (r) => {
        // older entries carry no projectId, but a project row's own id is the
        // project — and a deleted project has nothing left to open
        const pid = projectIdOf(r);
        if (!pid) return <span className="faint mono">{r.resourceId ? r.resourceId.slice(-6) : "—"}</span>;
        if (r.action === "project.delete") return <span className="faint">Deleted</span>;
        return (
          <Link href={`${basePath}/projects/${pid}`} onClick={(e) => e.stopPropagation()}>
            Open project
          </Link>
        );
      },
    },
  ];

  const toolbar = (
    <div className="filterbar">
      <input
        type="search" placeholder="Filter loaded entries by person, action or description"
        value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter audit entries"
      />
      <select value={resource} onChange={(e) => setParam("resource", e.target.value)} aria-label="Area">
        <option value="">All areas</option>
        {RESOURCES.map((r) => <option key={r} value={r}>{RESOURCE_LABEL[r] ?? r}</option>)}
      </select>
      <select value={actorId} onChange={(e) => setParam("actor", e.target.value)} aria-label="Person">
        <option value="">Everyone</option>
        {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <input type="date" value={from} max={to || undefined} aria-label="From date"
        onChange={(e) => setParam("from", e.target.value)} />
      <input type="date" value={to} min={from || undefined} aria-label="To date"
        onChange={(e) => setParam("to", e.target.value)} />
      {(resource || actorId || from || to || q) && (
        <Button variant="ghost" size="sm" onClick={() => {
          setQ("");
          startTransition(() => router.replace("?", { scroll: false }));
        }}>
          Reset
        </Button>
      )}
      {busy && <span className="faint">Loading…</span>}
    </div>
  );

  return (
    <>
      <PageHead
        title="Audit log"
        subtitle="Every change made in the CRM, who made it and what it was before."
      />

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r._id}
        onRowClick={(r) => setOpen(r)}
        toolbar={toolbar}
        pageSize={50}
        empty={{
          title: rows.length ? "No entries match these filters" : "Nothing recorded in this period",
          description: rows.length
            ? "Try widening the date range or clearing the area filter."
            : "Entries appear here as people create, edit and delete records.",
        }}
        footNote={<>Showing the {rows.length} most recent matching entries</>}
      />

      {open && <AuditDetail row={open} basePath={basePath} onClose={() => setOpen(null)} />}
    </>
  );
}

/* --------------------------------------------------------------- detail */

function val(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function AuditDetail({
  row, basePath, onClose,
}: { row: AuditRow; basePath: string; onClose: () => void }) {
  const changed = (row.meta?.changed ?? null) as Record<string, [unknown, unknown]> | null;
  const rest = { ...(row.meta ?? {}) };
  delete (rest as Record<string, unknown>).changed;
  const w = when(row.createdAt);

  return (
    <Modal
      title={row.action}
      size="md"
      onClose={onClose}
      foot={
        <>
          {projectIdOf(row) && row.action !== "project.delete" && (
            <Link className="btn secondary" href={`${basePath}/projects/${projectIdOf(row)}`}>
              Open project
            </Link>
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="stack">
        <div className="recfacts" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
          <div className="fact"><div className="k">When</div><div className="v">{w.d}, {w.t}</div></div>
          <div className="fact"><div className="k">Who</div><div className="v">{row.actorName || "—"}</div></div>
          <div className="fact"><div className="k">Role at the time</div><div className="v">{row.actorRole || "—"}</div></div>
          <div className="fact"><div className="k">Area</div><div className="v">{RESOURCE_LABEL[row.resource] ?? row.resource}</div></div>
        </div>

        <p style={{ margin: 0 }}>{entrySummary(row.action, row.label, row.meta)}</p>

        {changed && Object.keys(changed).length > 0 && (
          <div className="tablewrap">
            <table className="dt difftable">
              <thead>
                <tr><th>Field</th><th>Before</th><th>After</th></tr>
              </thead>
              <tbody>
                {Object.entries(changed).map(([k, pair]) => (
                  <tr key={k}>
                    <td style={{ fontWeight: 600 }}>{fieldLabel(k)}</td>
                    <td className="was">{val(pair?.[0])}</td>
                    <td className="now">{val(pair?.[1])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {Object.keys(rest).length > 0 && (
          <div>
            <div className="l" style={{ marginBottom: 6 }}>Context</div>
            <div className="tablewrap">
              <table className="dt">
                <tbody>
                  {Object.entries(rest).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ width: 160, fontWeight: 600 }}>{fieldLabel(k)}</td>
                      <td>{typeof v === "object" && v !== null ? JSON.stringify(v) : val(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="faint mono" style={{ margin: 0, fontSize: 11 }}>
          Record id {row.resourceId || "—"}
        </p>
      </div>
    </Modal>
  );
}
