"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { PARTNER_TYPES } from "@/lib/defaults";
import DataTable, { type Column } from "@/components/ui/DataTable";
import ContactPicker from "@/components/project/ContactPicker";
import { Badge, Banner, Button, Field, PageHead } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import type { ContactIntent } from "@/features/contacts/contact.match";
import type { ContactRow } from "@/components/project/types";

export interface PartnerRow {
  _id: string; name: string; type: string; contact: string;
  email: string; mobile: string; gstin: string; addr: string;
}

const BLANK = { name: "", type: "Receivable", contact: "", email: "", mobile: "", gstin: "", addr: "" };
type Form = typeof BLANK;

export default function PartnersView({
  rows, contacts, canCreate, canEdit,
}: { rows: PartnerRow[]; contacts: ContactRow[]; canCreate: boolean; canEdit: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();

  // global search links here as ?focus=<id> so the row can be revealed directly
  const focus = params.get("focus");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerRow | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  // "same person, or a new one?" — answered in the picker, sent with the save
  const [contactIntent, setContactIntent] = useState<ContactIntent | null>(null);
  const [directory, setDirectory] = useState<ContactRow[]>(contacts);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.name, r.email, r.contact, r.gstin].some((v) => (v ?? "").toLowerCase().includes(term)));
  }, [rows, q]);

  const focused = useMemo(
    () => (focus ? rows.find((r) => r._id === focus) ?? null : null), [rows, focus]);

  // a router.refresh() after a save re-renders the server component, so take
  // the directory it sends back
  useEffect(() => { setDirectory(contacts); }, [contacts]);

  function startCreate() { setEditing(null); setForm(BLANK); setErr(""); setContactIntent(null); setOpen(true); }
  function startEdit(p: PartnerRow) {
    setEditing(p);
    setForm({
      name: p.name ?? "", type: p.type || "Receivable", contact: p.contact ?? "",
      email: p.email ?? "", mobile: p.mobile ?? "", gstin: p.gstin ?? "", addr: p.addr ?? "",
    });
    setErr(""); setContactIntent(null); setOpen(true);
  }
  function set(k: keyof Form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.name.trim()) { setErr("A partner name is required."); return; }
    setBusy(true); setErr("");
    const body = JSON.stringify({ ...form, contactIntent });
    try {
      if (editing) await api(`/api/partners/${editing._id}`, { method: "PATCH", body });
      else await api("/api/partners", { method: "POST", body });
      setOpen(false);
      toast(editing ? "Partner updated" : "Partner added");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeContactRow(c: ContactRow) {
    const ok = await confirm({
      title: `Remove ${c.name} from the contact history?`,
      body: <>They come off the directory for <b>{c.partnerName}</b>. Projects already issued keep their own copy of the name, so no document changes.</>,
      confirmLabel: "Remove contact",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/contacts/${c._id}`, { method: "DELETE" });
      setDirectory((l) => l.filter((x) => x._id !== c._id));
      toast(`${c.name} removed from the directory`);
    } catch (e) { setErr((e as Error).message); }
  }

  const columns: Column<PartnerRow>[] = [
    {
      key: "name", header: "Partner", sortable: true,
      render: (r) => (
        <>
          <div style={{ fontWeight: 600 }} className="truncate">{r.name}</div>
          {r.contact && <div className="faint truncate">{r.contact}</div>}
        </>
      ),
    },
    {
      key: "type", header: "Type", sortable: true, width: "130px",
      render: (r) => <Badge tone={r.type === "Receivable" ? "ok" : r.type === "Payable" ? "warn" : "info"}>{r.type}</Badge>,
    },
    { key: "email", header: "Email", sortable: true, render: (r) => r.email || <span className="faint">—</span> },
    { key: "mobile", header: "Mobile", width: "150px", render: (r) => r.mobile || <span className="faint">—</span> },
    {
      key: "gstin", header: "GSTIN", width: "180px",
      render: (r) => r.gstin ? <span className="mono">{r.gstin}</span> : <span className="faint">—</span>,
    },
  ];

  return (
    <>
      <PageHead
        title="Partners"
        subtitle={`${rows.length} ${rows.length === 1 ? "partner" : "partners"} shared across the team`}
        actions={canCreate && <Button icon="plus" onClick={startCreate}>Add partner</Button>}
      />

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r._id}
        onRowClick={canEdit ? startEdit : undefined}
        focusKey={focus}
        toolbar={
          <div className="filterbar">
            <input type="search" placeholder="Filter by name, email, contact or GSTIN"
              value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter partners" />
            {focused && (
              <>
                <Badge tone="info">Showing {focused.name}</Badge>
                <Button variant="ghost" size="sm"
                  onClick={() => router.replace("?", { scroll: false })}>
                  Clear highlight
                </Button>
              </>
            )}
          </div>
        }
        rowActions={canEdit ? (r) => (
          <Button variant="ghost" size="sm" icon="edit" onClick={() => startEdit(r)}>Edit</Button>
        ) : undefined}
        empty={{
          title: rows.length ? "No partners match" : "No partners yet",
          description: rows.length
            ? "Try a different search term."
            : "Partners are reused across projects and proposals, so you only enter their details once.",
          action: canCreate && !rows.length ? <Button icon="plus" onClick={startCreate}>Add partner</Button> : undefined,
        }}
      />

      {open && (
        <Drawer
          title={editing ? "Edit partner" : "Add partner"}
          onClose={() => setOpen(false)}
          foot={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add partner"}</Button>
            </>
          }
        >
          <div className="stack">
            {err && <Banner tone="error">{err}</Banner>}
            <Field label="Partner name" required htmlFor="p-name">
              <input id="p-name" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </Field>
            <Field label="Partner type" htmlFor="p-type">
              <select id="p-type" value={form.type} onChange={(e) => set("type", e.target.value)}>
                {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Contact Person" htmlFor="p-contact"
              hint="Their email and mobile come with them. Previous contacts stay on record.">
              <ContactPicker
                id="p-contact"
                value={form.contact}
                email={form.email}
                mobile={form.mobile}
                contacts={directory}
                partnerId={editing?._id ?? ""}
                partnerName={form.name}
                intent={contactIntent}
                onIntentChange={setContactIntent}
                onRemove={canEdit ? removeContactRow : undefined}
                onChange={(v) => set("contact", v)}
                onPick={(c) => setForm((f) => ({ ...f, contact: c.name, email: c.email, mobile: c.mobile }))}
              />
            </Field>
            <div className="grid k2">
              <Field label="Email" htmlFor="p-email">
                <input id="p-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Mobile" htmlFor="p-mobile">
                <input id="p-mobile" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
              </Field>
            </div>
            <Field label="GSTIN" htmlFor="p-gstin" hint="Used on estimates and invoice requests.">
              <input id="p-gstin" value={form.gstin} onChange={(e) => set("gstin", e.target.value)} />
            </Field>
            <Field label="Address" htmlFor="p-addr">
              <textarea id="p-addr" rows={3} value={form.addr} onChange={(e) => set("addr", e.target.value)}
                placeholder="Street, area, city, state, PIN" />
            </Field>
          </div>
        </Drawer>
      )}
    </>
  );
}
