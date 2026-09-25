"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { PARTNER_TYPES } from "@/lib/defaults";
import { fmtDate } from "@/features/documents/templates/shared";
import DataTable, { type Column } from "@/components/ui/DataTable";
import { Badge, Button, PageHead } from "@/components/ui/primitives";
import NewProjectButton from "@/components/project/NewProjectButton";
import DeleteProjectButton from "@/components/project/DeleteProjectButton";
import Icon from "@/components/ui/Icon";

export interface ProjectRow {
  _id: string; projName: string; cName: string; partnerType: string;
  estNo: string; date: string; koEnd: string; itemCount: number;
  gstMode: string; ownerId: string; updatedAt: string;
}

export default function ProjectsListView({
  rows, basePath, canCreate, canDelete, currentUserId,
}: {
  rows: ProjectRow[]; basePath: string;
  canCreate: boolean; canDelete: boolean; currentUserId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, startTransition] = useTransition();

  // filters live in the URL so a filtered list can be shared or bookmarked
  const q = params.get("q") ?? "";
  const type = params.get("type") ?? "";
  const mine = params.get("mine") === "1";

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }));
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (type && r.partnerType !== type) return false;
      if (mine && r.ownerId !== currentUserId) return false;
      if (!term) return true;
      return [r.projName, r.cName, r.estNo].some((v) => (v ?? "").toLowerCase().includes(term));
    });
  }, [rows, q, type, mine, currentUserId]);


  const columns: Column<ProjectRow>[] = [
    {
      key: "projName", header: "Project",
      render: (r) => (
        <>
          <div style={{ fontWeight: 600 }} className="truncate">{r.projName || "Untitled project"}</div>
          {r.estNo && <div className="faint mono">{r.estNo}</div>}
        </>
      ),
    },
    { key: "cName", header: "Partner", render: (r) => r.cName || <span className="faint">—</span> },
    {
      key: "partnerType", header: "Type", width: "120px",
      render: (r) => <Badge tone={r.partnerType === "Receivable" ? "ok" : r.partnerType === "Payable" ? "warn" : "info"}>{r.partnerType}</Badge>,
    },
    {
      key: "itemCount", header: "Content", align: "right", width: "100px",
      render: (r) => <span className="num">{r.itemCount}</span>,
    },
    {
      key: "date", header: "Start Date", sortable: true, width: "130px",
      render: (r) => <span className="nowrap">{r.date ? fmtDate(r.date) : "—"}</span>,
    },
    {
      key: "koEnd", header: "End Date", sortable: true, width: "130px",
      render: (r) => <span className="nowrap">{r.koEnd ? fmtDate(r.koEnd) : <span className="faint">—</span>}</span>,
    },
  ];

  const toolbar = (
    <div className="filterbar">
      <input
        type="search" placeholder="Filter by project, partner or estimate no."
        defaultValue={q} onChange={(e) => setParam("q", e.target.value)}
        aria-label="Filter projects"
      />
      <select value={type} onChange={(e) => setParam("type", e.target.value)} aria-label="Partner type">
        <option value="">All partner types</option>
        {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <Button variant={mine ? "primary" : "secondary"} size="sm"
        onClick={() => setParam("mine", mine ? "" : "1")}>
        Only mine
      </Button>
      {(q || type || mine) && (
        <Button variant="ghost" size="sm" onClick={() => startTransition(() => router.replace("?", { scroll: false }))}>
          Reset
        </Button>
      )}
      {busy && <span className="faint">Filtering…</span>}
    </div>
  );

  return (
    <>
      <PageHead
        title="Projects"
        subtitle={`${rows.length} ${rows.length === 1 ? "project" : "projects"}`}
        actions={canCreate && <NewProjectButton basePath={basePath} />}
      />

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r._id}
        onRowClick={(r) => router.push(`${basePath}/${r._id}`)}
        toolbar={toolbar}
        rowActions={(r) => (
          <>
            {canDelete && (
              <DeleteProjectButton
                id={r._id} name={r.projName} estNo={r.estNo} itemCount={r.itemCount}
              />
            )}
            <Button variant="ghost" size="sm" onClick={() => router.push(`${basePath}/${r._id}`)} aria-label="Open project">
              <Icon name="chevronRight" size={15} />
            </Button>
          </>
        )}
        empty={{
          title: rows.length ? "No projects match these filters" : "No projects yet",
          description: rows.length
            ? "Try clearing the search or partner-type filter."
            : "A project holds the partner, the content line-up and every document you generate for it.",
          action: canCreate && !rows.length ? <NewProjectButton basePath={basePath} /> : undefined,
        }}
      />
    </>
  );
}
