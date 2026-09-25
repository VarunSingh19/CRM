"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { SECTIONS, secShort } from "@/lib/defaults";
import DataTable, { type Column } from "@/components/ui/DataTable";
import { Badge, Banner, Button, Field, PageHead } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";

export interface OfferingRow {
  _id: string; section: string; name: string;
  cardTypes: string[]; promo: string[]; stream: string[]; produced: string[];
  incl: string; excl: string; dev: string; duration: string; sortOrder: number;
}

const BLANK = {
  section: SECTIONS[0], name: "", cardTypes: "", promo: "", stream: "", produced: "",
  incl: "", excl: "", dev: "", duration: "",
};
type Form = typeof BLANK;

const toList = (s: string): string[] => s.split(",").map((x) => x.trim()).filter(Boolean);
const fromList = (a: string[] = []): string => a.join(", ");

const tone = (section: string) =>
  section === "Daily Pulse" ? "warn" : section === "Media Services" ? "ok" : "info";

export default function CatalogView({ rows, editable }: { rows: OfferingRow[]; editable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OfferingRow | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [section, setSection] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (section && r.section !== section) return false;
      if (!term) return true;
      return [r.name, r.incl, r.excl].some((v) => (v ?? "").toLowerCase().includes(term));
    });
  }, [rows, q, section]);

  function startCreate() { setEditing(null); setForm(BLANK); setErr(""); setOpen(true); }
  function startEdit(o: OfferingRow) {
    setEditing(o);
    setForm({
      section: o.section, name: o.name,
      cardTypes: fromList(o.cardTypes), promo: fromList(o.promo),
      stream: fromList(o.stream), produced: fromList(o.produced),
      incl: o.incl ?? "", excl: o.excl ?? "", dev: o.dev ?? "", duration: o.duration ?? "",
    });
    setErr(""); setOpen(true);
  }
  function set(k: keyof Form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.name.trim()) { setErr("An offering name is required."); return; }
    setBusy(true); setErr("");
    const body = JSON.stringify({
      section: form.section, name: form.name.trim(),
      cardTypes: toList(form.cardTypes), promo: toList(form.promo),
      stream: toList(form.stream), produced: toList(form.produced),
      incl: form.incl, excl: form.excl, dev: form.dev, duration: form.duration,
    });
    try {
      if (editing) await api(`/api/catalog/${editing._id}`, { method: "PATCH", body });
      else await api("/api/catalog", { method: "POST", body });
      setOpen(false);
      toast(editing ? "Offering updated" : "Offering added");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function retire(o: OfferingRow) {
    const ok = await confirm({
      title: `Delete “${o.name}”?`,
      body: <>It leaves the catalogue for new work. Existing line items keep their own copy of the scope, so nothing already quoted changes.</>,
      confirmLabel: "Delete offering",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/catalog/${o._id}`, { method: "DELETE" });
      toast("Offering deleted");
      router.refresh();
    } catch (e) { setErr((e as Error).message); }
  }

  const columns: Column<OfferingRow>[] = [
    {
      key: "section", header: "Section", sortable: true, width: "150px",
      render: (r) => <Badge tone={tone(r.section)}>{secShort(r.section)}</Badge>,
    },
    {
      key: "name", header: "Offering", sortable: true,
      render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span>,
    },
    {
      key: "cardTypes", header: "Card types",
      render: (r) => r.cardTypes.length
        ? <span className="truncate">{r.cardTypes.join(", ")}</span>
        : <span className="faint">Not applicable</span>,
    },
    {
      key: "duration", header: "Duration", sortable: true, width: "120px",
      render: (r) => r.duration || <span className="faint">—</span>,
    },
    {
      key: "incl", header: "Scope", width: "110px",
      render: (r) => (
        <span className="faint">
          {r.incl ? "Inclusions" : "—"}{r.incl && r.excl ? " + exclusions" : ""}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title="Offerings catalog"
        subtitle={
          editable
            ? "Inclusions and exclusions here pre-fill every new content line item."
            : "Reference list. Inclusions and exclusions pre-fill new content line items."
        }
        actions={editable && <Button icon="plus" onClick={startCreate}>Add offering</Button>}
      />
      {err && !open && <p className="err" style={{ marginBottom: 12 }}>{err}</p>}

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r._id}
        onRowClick={editable ? startEdit : undefined}
        pageSize={30}
        toolbar={
          <div className="filterbar">
            <input type="search" placeholder="Filter by name or scope text"
              value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter offerings" />
            <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="Section">
              <option value="">All sections</option>
              {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        }
        rowActions={editable ? (r) => (
          <>
            <Button variant="ghost" size="sm" icon="edit" onClick={() => startEdit(r)}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={() => retire(r)}>Delete</Button>
          </>
        ) : undefined}
        empty={{
          title: rows.length ? "No offerings match" : "Catalog is empty",
          description: rows.length
            ? "Try a different search term or section."
            : "Offerings define the media products you sell and carry their standard inclusions and exclusions.",
          action: editable && !rows.length ? <Button icon="plus" onClick={startCreate}>Add offering</Button> : undefined,
        }}
      />

      {open && (
        <Drawer
          title={editing ? "Edit offering" : "Add offering"}
          onClose={() => setOpen(false)}
          foot={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save offering"}</Button>
            </>
          }
        >
          <div className="stack">
            {err && <Banner tone="error">{err}</Banner>}
            <Field label="Media section" htmlFor="o-section">
              <select id="o-section" value={form.section} onChange={(e) => set("section", e.target.value)}>
                {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Offering name" required htmlFor="o-name">
              <input id="o-name" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </Field>
            <Field label="Duration" htmlFor="o-duration" hint="e.g. 72 Hours, 90 Days, 1 Month.">
              <input id="o-duration" value={form.duration} onChange={(e) => set("duration", e.target.value)} />
            </Field>

            <div className="section-label">Selectable options</div>
            <Field label="Card types" htmlFor="o-cards" hint="Comma separated. Leave blank for “not applicable”.">
              <input id="o-cards" value={form.cardTypes} onChange={(e) => set("cardTypes", e.target.value)} />
            </Field>
            <Field label="Promotion types" htmlFor="o-promo" hint="Comma separated.">
              <input id="o-promo" value={form.promo} onChange={(e) => set("promo", e.target.value)} />
            </Field>
            <Field label="Streamed as" htmlFor="o-stream" hint="Comma separated.">
              <input id="o-stream" value={form.stream} onChange={(e) => set("stream", e.target.value)} />
            </Field>
            <Field label="Produced by" htmlFor="o-produced" hint="Comma separated.">
              <input id="o-produced" value={form.produced} onChange={(e) => set("produced", e.target.value)} />
            </Field>

            <div className="section-label">Standard scope</div>
            <Field label="Inclusions" htmlFor="o-incl" hint="Copied onto each new line item using this offering.">
              <textarea id="o-incl" rows={4} value={form.incl} onChange={(e) => set("incl", e.target.value)} />
            </Field>
            <Field label="Exclusions" htmlFor="o-excl">
              <textarea id="o-excl" rows={4} value={form.excl} onChange={(e) => set("excl", e.target.value)} />
            </Field>
            <Field label="Standard deviations" htmlFor="o-dev">
              <textarea id="o-dev" rows={2} value={form.dev} onChange={(e) => set("dev", e.target.value)} />
            </Field>
          </div>
        </Drawer>
      )}
    </>
  );
}
