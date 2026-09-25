"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { num } from "@/lib/money";
import { PARTNER_TYPES, SECTIONS, secShort, STATUSES } from "@/lib/defaults";
import { fmtDate } from "@/features/documents/templates/shared";
import ItemCard from "@/components/project/ItemCard";
import SchedulingTable from "@/components/project/SchedulingTable";
import Ledger from "@/components/project/Ledger";
import DocPreview, { type DocType } from "@/components/project/DocPreview";
import ProposeModal from "@/components/project/ProposeModal";
import PartnerPicker from "@/components/project/PartnerPicker";
import ContactPicker from "@/components/project/ContactPicker";
import OwnerPicker from "@/components/project/OwnerPicker";
import { normName, type ContactIntent } from "@/features/contacts/contact.match";
import ActivityFeed, { type ActivityEntry } from "@/components/project/ActivityFeed";
import type { ContactRow, Item, Offering, PartnerRow, ProjectMap, Role, StaffRow } from "@/components/project/types";
import { Badge, Banner, Button, Card, EmptyState, Field, statusTone } from "@/components/ui/primitives";
import Icon from "@/components/ui/Icon";
import { Tabs } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";

const DOC_BUTTONS: { key: DocType; ic: string; color: string; title: string; blurb: string }[] = [
  { key: "estimate", ic: "E", color: "var(--accent)", title: "Estimate", blurb: "Client-facing. Sub-total, discount and grand total." },
  { key: "kickoff", ic: "K", color: "var(--primary)", title: "Kick off", blurb: "Scope, schedule and reminders. No commercials." },
  { key: "invoice", ic: "I", color: "var(--link)", title: "Invoice request", blurb: "For finance, to raise the tax invoice." },
  { key: "calendar", ic: "C", color: "var(--ok)", title: "Content calendar", blurb: "Kanban or month grid, with Propose actions." },
];

/** Fields a document cannot be generated without. */
const REQUIRED: [string, string][] = [
  ["projName", "project name"], ["partnerType", "partner type"], ["cName", "partner name"],
  ["cEmail", "partner email"], ["cMobile", "partner mobile"], ["cAddr", "partner address"],
  ["estNo", "estimate no."], ["date", "date"],
];

export default function ProjectEditor({
  id, role, initialProject, initialItems, offerings, initialPartners, initialContacts, staff, canEditProject,
}: {
  id: string; role: Role;
  initialProject: Record<string, unknown>;
  initialItems: Item[];
  offerings: Offering[];
  initialPartners: PartnerRow[];
  initialContacts: ContactRow[];
  staff: StaffRow[];
  canEditProject: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();

  // global search deep-links here as ?tab=content&focus=<lineItemId>
  const focus = params.get("focus");
  const wantedTab = params.get("tab");

  const [project, setProject] = useState<ProjectMap>(initialProject as ProjectMap);
  const [savedProject, setSavedProject] = useState<ProjectMap>(initialProject as ProjectMap);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [savedItems, setSavedItems] = useState<Item[]>(initialItems);
  const [partners, setPartners] = useState<PartnerRow[]>(initialPartners);
  const [contacts, setContacts] = useState<ContactRow[]>(initialContacts);
  // "same person, or a new one?" — answered in the picker, sent with the save
  const [contactIntent, setContactIntent] = useState<ContactIntent | null>(null);

  const [tab, setTab] = useState(wantedTab === "content" ? "content" : "overview");
  // Which cards are open. Absent means closed, so the tab opens as a scannable
  // list of headers and the reader expands what they actually want.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [partnerFormOpen, setPartnerFormOpen] = useState(
    !!String((initialProject as ProjectMap).cName ?? "").trim());
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bad, setBad] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Admin-only, and fetched the first time the tab is opened rather than on
  // every project load — most visits never ask for it.
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
  const [actErr, setActErr] = useState("");

  const [doc, setDoc] = useState<DocType | null>(null);
  const [proposeFor, setProposeFor] = useState<Item | null>(null);
  const [propHtml, setPropHtml] = useState("");

  useEffect(() => {
    if (tab !== "activity" || activity || actErr) return;
    let alive = true;
    api<ActivityEntry[]>(`/api/audit?projectId=${id}`)
      .then((r) => { if (alive) setActivity(r); })
      .catch((e) => { if (alive) setActErr((e as Error).message); });
    return () => { alive = false; };
  }, [tab, activity, actErr, id]);

  /**
   * A new card lands at the foot of the list, where the toast is the only sign
   * anything happened. Close whatever the reader had open, leave just this one
   * expanded, and bring it to the top of the view.
   */
  function revealOnly(newId: string) {
    setExpanded({ [newId]: true });
    setJustAdded(newId);
  }

  // runs after the new card is in the DOM; .item carries a scroll-margin so it
  // clears the sticky header on a phone as well as a desktop
  useEffect(() => {
    if (!justAdded) return;
    document.getElementById(`item-${justAdded}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
    setJustAdded(null);
  }, [justAdded]);

  // reveal the linked card: keep it expanded and bring it into view
  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`item-${focus}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus, tab]);

  const isBarter = (project.partnerType as string) === "Barter";
  /**
   * Barter is settled in kind, so those projects carry no commercials unless
   * the box on the partner form is ticked. Receivable and Payable are unchanged
   * — they always have them. Ops never sees money either way.
   */
  const commercialsOn = !isBarter || !!project.barterCommercials;
  const showMoney = role !== "ops" && commercialsOn;

  // the tab disappears when commercials are switched off, so do not leave the
  // reader looking at a panel that no longer renders
  useEffect(() => {
    if (tab === "commercials" && !showMoney) setTab("overview");
  }, [tab, showMoney]);
  const projectDirty = JSON.stringify(project) !== JSON.stringify(savedProject);
  const dirtyIds = useMemo(() => Object.keys(dirty).filter((k) => dirty[k]), [dirty]);
  const hasChanges = projectDirty || dirtyIds.length > 0;

  const bySection = useMemo(() => {
    const m: Record<string, Offering[]> = {};
    for (const o of offerings) (m[o.section] ||= []).push(o);
    return m;
  }, [offerings]);
  const offeringOf = useCallback(
    (name: string) => offerings.find((c) => c.name === name) ?? null, [offerings]);

  /* ------------------------------------------------------------ project */
  function setP(k: string, v: unknown) {
    setProject((p) => ({ ...p, [k]: v }));
    if (bad.length) setBad([]);
  }
  const entity = (project.entity ?? {}) as Record<string, unknown>;
  function setE(k: string, v: unknown) { setP("entity", { ...entity, [k]: v }); }

  /* ------------------------------------------------------------ items */
  function patchItem(itemId: string, k: keyof Item, v: unknown) {
    setItems((list) => list.map((x) => (x._id === itemId ? ({ ...x, [k]: v } as Item) : x)));
    setDirty((d) => ({ ...d, [itemId]: true }));
  }

  /** Switching offering re-applies that catalog row's prefilled scope. */
  function changeOffering(itemId: string, name: string) {
    const o = offeringOf(name);
    if (!o) return;
    setItems((list) => list.map((x) => x._id === itemId ? {
      ...x, name, section: o.section,
      cardType: o.cardTypes[0] ?? "", promo: o.promo[0] ?? "",
      stream: o.stream[0] ?? "", produced: o.produced[0] ?? "",
      incl: o.incl, excl: o.excl, dev: o.dev, duration: o.duration,
    } : x));
    setDirty((d) => ({ ...d, [itemId]: true }));
  }

  async function saveAll() {
    setBusy(true); setErr("");
    try {
      const jobs: Promise<unknown>[] = [];
      if (projectDirty) {
        jobs.push(api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(project) }));
      }
      for (const itemId of dirtyIds) {
        const it = items.find((x) => x._id === itemId);
        if (it) jobs.push(api(`/api/line-items/${itemId}`, { method: "PATCH", body: JSON.stringify(it) }));
      }
      await Promise.all(jobs); // parallel, not one request at a time
      setSavedProject(project);
      setSavedItems(items);
      setDirty({});
      toast(`Saved${dirtyIds.length ? ` · ${dirtyIds.length} content ${dirtyIds.length === 1 ? "item" : "items"}` : ""}`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Reverts edits only. Adds and deletes already hit the server, so they stay. */
  function discard() {
    setProject(savedProject);
    setItems(savedItems);
    setDirty({});
    setErr("");
  }

  async function addItem(section: string) {
    const o = (bySection[section] ?? [])[0];
    if (!o) { setErr(`No offering exists in ${section} yet.`); return; }
    setBusy(true); setErr("");
    try {
      const created = await api<Item>("/api/line-items", {
        method: "POST",
        body: JSON.stringify({
          projectId: id, section, name: o.name,
          cardType: o.cardTypes[0] ?? "", promo: o.promo[0] ?? "",
          stream: o.stream[0] ?? "", produced: o.produced[0] ?? "",
          incl: o.incl, excl: o.excl, dev: o.dev, duration: o.duration,
          status: "Planner", qty: 1, rate: 0, discType: "amount", discValue: 0,
          amountOverride: "", sortOrder: items.length,
        }),
      });
      setItems((l) => [...l, created]);
      setSavedItems((l) => [...l, created]);
      setTab("content");
      revealOnly(created._id);
      toast(`${secShort(section)} item added`);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function duplicateItem(it: Item) {
    setBusy(true);
    try {
      const { _id, projectId, ...rest } = it;
      void _id; void projectId;
      const created = await api<Item>("/api/line-items", {
        method: "POST",
        body: JSON.stringify({ ...rest, projectId: id, sortOrder: it.sortOrder ?? 0 }),
      });
      setItems((l) => [...l, created]);
      setSavedItems((l) => [...l, created]);
      revealOnly(created._id);
      toast("Content item duplicated");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function deleteItem(itemId: string) {
    const ok = await confirm({
      title: "Remove this content item?",
      body: <>It comes off the project and out of every document generated from here on.</>,
      confirmLabel: "Remove item",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/api/line-items/${itemId}`, { method: "DELETE" });
      setItems((l) => l.filter((x) => x._id !== itemId));
      setSavedItems((l) => l.filter((x) => x._id !== itemId));
      setDirty((d) => { const n = { ...d }; delete n[itemId]; return n; });
      setSelected((s) => { const n = new Set(s); n.delete(itemId); return n; });
      toast("Content item removed");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  /** Bulk operations go in one request, not one per row. */
  async function bulkStatus(status: string) {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    try {
      await api("/api/line-items/bulk", { method: "PATCH", body: JSON.stringify({ ids, patch: { status } }) });
      setItems((l) => l.map((x) => (selected.has(x._id) ? { ...x, status } : x)));
      setSavedItems((l) => l.map((x) => (selected.has(x._id) ? { ...x, status } : x)));
      setSelected(new Set());
      toast(`${ids.length} ${ids.length === 1 ? "item" : "items"} set to ${status}`);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;
    const ok = await confirm({
      title: `Remove ${ids.length} content ${ids.length === 1 ? "item" : "items"}?`,
      body: <>They come off the project and out of every document generated from here on.</>,
      confirmLabel: `Remove ${ids.length}`,
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api("/api/line-items/bulk", { method: "POST", body: JSON.stringify({ op: "delete", ids }) });
      setItems((l) => l.filter((x) => !selected.has(x._id)));
      setSavedItems((l) => l.filter((x) => !selected.has(x._id)));
      setDirty((d) => { const n = { ...d }; for (const id of selected) delete n[id]; return n; });
      setSelected(new Set());
      toast(`${ids.length} removed`);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  /* ------------------------------------------------------------ partners
     project.partnerId is the link between this project's partner snapshot and
     the reusable partner record. Once set — whether by picking an existing
     partner or by saving a new one — every later edit updates that same record
     instead of creating a duplicate. */
  const linkedPartner = useMemo(
    () => partners.find((x) => x._id === project.partnerId) ?? null,
    [partners, project.partnerId]
  );

  const partnerForm = useMemo(() => ({
    name: String(project.cName ?? "").trim(),
    type: String(project.partnerType ?? ""),
    contact: String(project.cContact ?? "").trim(),
    email: String(project.cEmail ?? "").trim(),
    mobile: String(project.cMobile ?? "").trim(),
    gstin: String(project.cGstin ?? "").trim(),
    addr: String(project.cAddr ?? "").trim(),
  }), [project]);

  /** Enough to be worth keeping as a reusable record. */
  const partnerSavable = !!(partnerForm.name && partnerForm.type && partnerForm.email);

  /** Has the snapshot drifted from the linked record? */
  const partnerDirty = !!linkedPartner && (
    ["name", "type", "contact", "email", "mobile", "gstin", "addr"] as const
  ).some((k) => String(linkedPartner[k] ?? "").trim() !== partnerForm[k]);

  function applyPartner(row: PartnerRow) {
    setProject((p) => ({
      ...p, partnerId: row._id, cName: row.name, partnerType: row.type || p.partnerType,
      cContact: row.contact, cEmail: row.email, cMobile: row.mobile, cGstin: row.gstin, cAddr: row.addr,
    }));
    setPartnerFormOpen(true);
    toast(`Linked to ${row.name} — remember to save the project`);
  }

  function startNewPartner() {
    setProject((p) => ({
      ...p, partnerId: undefined, cName: "", partnerType: "",
      cContact: "", cEmail: "", cMobile: "", cGstin: "", cAddr: "",
    }));
    setPartnerFormOpen(true);
  }

  function unlinkPartner() {
    setProject((p) => ({ ...p, partnerId: undefined }));
    toast("Unlinked. Saving now will create a separate partner record.");
  }

  /**
   * Mirrors what recordContact just did on the server — following the same
   * intent, so a correction rewrites the row in place and a handover adds one —
   * to keep the picker honest without refetching the whole directory.
   */
  function noteContact(row: PartnerRow, used: ContactIntent | null) {
    const name = String(row.contact ?? "").trim();
    if (!name) return;
    setContacts((list) => {
      const mine = list.filter((c) => c.partnerId === row._id);
      const byName = mine.find((c) => normName(c.name) === normName(name)) ?? null;
      const target =
        used?.mode === "update"
          ? (used.contactId ? mine.find((c) => c._id === used.contactId) : null)
          ?? byName ?? mine.find((c) => c.current) ?? null
          : byName;

      const next = list.map((c) => (c.partnerId === row._id ? { ...c, current: false } : c));
      const entry: ContactRow = {
        _id: target?._id ?? `local-${row._id}-${normName(name)}`,
        partnerId: row._id, partnerName: row.name,
        name, email: row.email ?? "", mobile: row.mobile ?? "", current: true,
      };
      const at = target ? next.findIndex((c) => c._id === target._id) : -1;
      if (at >= 0) next[at] = entry; else next.push(entry);
      return next;
    });
  }

  async function savePartner() {
    if (!partnerSavable) return;
    setBusy(true); setErr("");
    const used = contactIntent;
    const body = JSON.stringify({ ...partnerForm, contactIntent: used });
    try {
      if (linkedPartner) {
        const saved = await api<PartnerRow>(`/api/partners/${linkedPartner._id}`, { method: "PATCH", body });
        setPartners((l) => l.map((x) => (x._id === saved._id ? saved : x)));
        noteContact(saved, used);
        toast(`${saved.name} updated`);
      } else {
        const saved = await api<PartnerRow>("/api/partners", { method: "POST", body });
        setPartners((l) => [...l, saved]);
        noteContact(saved, used);
        // link immediately, so an edit made seconds later updates this record
        setProject((p) => ({ ...p, partnerId: saved._id }));
        toast(`${saved.name} saved to the shared list`);
      }
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
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
      setContacts((l) => l.filter((x) => x._id !== c._id));
      toast(`${c.name} removed from the directory`);
    } catch (e) { setErr((e as Error).message); }
  }


  /* ------------------------------------------------------------ documents */
  function openDoc(type: DocType) {
    setErr("");
    const missing = REQUIRED.filter(([k]) => !String(project[k] ?? "").trim());
    setBad(missing.map(([k]) => k));
    const labels = missing.map(([, l]) => l);
    if (!items.length) labels.push("at least one content item");
    if (labels.length) {
      setErr(`Still needed before generating: ${labels.join(", ")}.`);
      setTab("overview");
      return;
    }
    if (hasChanges) { setErr("Save your changes first — documents are built from stored data."); return; }
    setDoc(type);
  }

  /* ------------------------------------------------------------ render */
  const F = (k: string, label: string, type = "text", required = false) => (
    <Field key={k} label={label} required={required} htmlFor={`p-${k}`}
      error={bad.includes(k) ? "Required for documents" : undefined}>
      <input id={`p-${k}`} type={type} value={(project[k] as string) ?? ""}
        className={bad.includes(k) ? "bad" : ""} disabled={!canEditProject}
        onChange={(e) => setP(k, e.target.value)} />
    </Field>
  );

  const statusSummary = STATUSES.map((s) => ({ s, n: items.filter((i) => i.status === s).length }))
    .filter((x) => x.n > 0);

  const tabs = [
    { key: "overview", label: "Partner Details" },
    { key: "content", label: "Content", count: items.length },
    { key: "scheduling", label: "Scheduling", count: items.length },
    ...(showMoney ? [{ key: "commercials", label: "Commercials" }] : []),
    { key: "documents", label: "Documents" },
    ...(role === "admin" ? [{ key: "activity", label: "Activity" }] : []),
  ];

  return (
    <>
      {/* record header */}
      <div className="rechead">
        <Link href={`/${role}/projects`} className="backlink">
          <Icon name="chevronLeft" size={15} />
          All projects
        </Link>

        <div className="top">
          <div style={{ minWidth: 0 }}>
            <h1 className="truncate">{(project.projName as string) || "Untitled project"}</h1>
            <div className="sub muted">
              {(project.cName as string) || "No partner set"}
              {project.estNo ? <> · <span className="mono">{project.estNo as string}</span></> : null}
            </div>
          </div>
          <div className="actions">
            {statusSummary.map(({ s, n }) => (
              <Badge key={s} tone={statusTone(s)} dot>{n} {s.toLowerCase()}</Badge>
            ))}
          </div>
        </div>

        <div className="recfacts">
          <div className="fact"><div className="k">Partner type</div><div className="v">{(project.partnerType as string) || "—"}</div></div>
          <div className="fact"><div className="k">Date</div><div className="v">{project.date ? fmtDate(project.date as string) : "—"}</div></div>
          <div className="fact"><div className="k">Project start</div><div className="v">{project.koStart ? fmtDate(project.koStart as string) : "—"}</div></div>
          <div className="fact"><div className="k">Project end</div><div className="v">{project.koEnd ? fmtDate(project.koEnd as string) : "—"}</div></div>
          <div className="fact"><div className="k">Account owner</div><div className="v">{(project.koOwner as string) || "—"}</div></div>
          <div className="fact"><div className="k">Production owner</div><div className="v">{(project.koProducer as string) || "—"}</div></div>
        </div>
      </div>

      {err && <Banner tone="error">{err}</Banner>}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {/* ---------------------------------------------------------- overview */}
      {tab === "overview" && (
        <>


          <Card title="Partner">
            {canEditProject && (
              <div className="partnerbar">
                {linkedPartner ? (
                  <>
                    <span className="linkedchip">
                      <span className="dot" />
                      Linked to {linkedPartner.name}
                    </span>
                    <Button variant="ghost" size="sm" onClick={unlinkPartner}>Unlink</Button>
                  </>
                ) : (
                  <span className="muted">
                    {partnerFormOpen ? "Not linked to a saved partner yet." : "Start from a saved partner, or enter a new one."}
                  </span>
                )}

                <div className="spacer" />

                <PartnerPicker
                  partners={partners}
                  onPick={applyPartner}
                  onCreateNew={startNewPartner}
                  label={linkedPartner ? "Change partner" : "Choose a partner"}
                />
              </div>
            )}

            {!partnerFormOpen && canEditProject ? (
              <EmptyState
                icon="partners"
                title="No partner on this project yet"
                description="Pick one from the shared list to copy their details in, or enter a new partner from scratch."
              />
            ) : (
              <>
                <div className="grid k2">
                  {F("cName", "Partner name", "text", true)}
                  <Field label="Partner type" required htmlFor="p-partnerType"
                    error={bad.includes("partnerType") ? "Required for documents" : undefined}>
                    <select id="p-partnerType" value={(project.partnerType as string) ?? ""}
                      className={bad.includes("partnerType") ? "bad" : ""} disabled={!canEditProject}
                      onChange={(e) => setP("partnerType", e.target.value)}>
                      <option value="">Select…</option>
                      {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  {isBarter && (
                    <Field label="Commercials"
                      hint="Barter is settled in kind, so pricing stays out of this project unless you need it.">
                      <label className="checkrow">
                        <input type="checkbox" checked={!!project.barterCommercials}
                          disabled={!canEditProject}
                          onChange={(e) => setP("barterCommercials", e.target.checked)} />
                        <span>Add commercials to this project</span>
                      </label>
                    </Field>
                  )}
                  <Field label="Contact Person" htmlFor="p-cContact"
                    hint="Their email and mobile come with them. Previous contacts stay on record.">
                    <ContactPicker
                      id="p-cContact"
                      value={(project.cContact as string) ?? ""}
                      email={(project.cEmail as string) ?? ""}
                      mobile={(project.cMobile as string) ?? ""}
                      contacts={contacts}
                      partnerId={(project.partnerId as string) ?? ""}
                      partnerName={(project.cName as string) ?? ""}
                      disabled={!canEditProject}
                      intent={contactIntent}
                      onIntentChange={setContactIntent}
                      onRemove={canEditProject ? removeContactRow : undefined}
                      onChange={(v) => setP("cContact", v)}
                      onPick={(c) => {
                        setProject((p) => ({
                          ...p, cContact: c.name, cEmail: c.email, cMobile: c.mobile,
                        }));
                        if (bad.length) setBad([]);
                      }}
                    />
                  </Field>
                  {F("cEmail", "Partner email", "email", true)}
                  {F("cMobile", "Partner mobile", "text", true)}
                  {F("cGstin", "Partner GSTIN")}
                </div>
                <div style={{ marginTop: 12 }}>
                  <Field label="Partner address" required htmlFor="p-cAddr"
                    error={bad.includes("cAddr") ? "Required for documents" : undefined}>
                    <textarea id="p-cAddr" rows={2} value={(project.cAddr as string) ?? ""}
                      className={bad.includes("cAddr") ? "bad" : ""} disabled={!canEditProject}
                      placeholder="Street, area, city, state, PIN"
                      onChange={(e) => setP("cAddr", e.target.value)} />
                  </Field>
                </div>

                {canEditProject && (
                  <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
                    <span className="muted" style={{ marginRight: "auto" }}>
                      {!partnerSavable
                        ? "Name, type and email are needed before this can be saved to the shared list."
                        : linkedPartner
                          ? partnerDirty
                            ? "You have changed these details since they were linked."
                            : `In step with ${linkedPartner.name}.`
                          : "Not yet on the shared partner list."}
                    </span>
                    <Button
                      onClick={savePartner}
                      disabled={busy || !partnerSavable || (!!linkedPartner && !partnerDirty)}
                    >
                      {linkedPartner ? "Update partner" : "Save as partner"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>

          <Card title="Project details">
            <div className="grid k3">
              {F("projName", "Project name", "text", true)}
              {F("date", "Date", "date", true)}
              <Field label="Estimate no." htmlFor="p-estNo"
                hint="Assigned by the system when the project is created. It cannot be changed.">
                <input id="p-estNo" className="mono" value={(project.estNo as string) ?? "—"} disabled readOnly />
              </Field>
              {F("validity", "Valid for (days)", "number")}
              {F("pos", "Place of supply")}
              {F("cPo", "Partner PO / reference")}
            </div>
          </Card>

          <Card title="Kick off">
            <div className="grid k3">
              {F("koStart", "Project start date", "date")}
              {F("koEnd", "Project end date", "date")}
              {F("koContract", "Contract end date", "date")}
              <Field label="Account owner" htmlFor="p-koOwner"
                hint="Sales colleagues first. A name off the team is kept as typed.">
                <OwnerPicker
                  id="p-koOwner"
                  seat="account"
                  value={(project.koOwner as string) ?? ""}
                  staff={staff}
                  disabled={!canEditProject}
                  invalid={bad.includes("koOwner")}
                  onChange={(v) => setP("koOwner", v)}
                />
              </Field>
              <Field label="Production owner" htmlFor="p-koProducer"
                hint="Production colleagues first. A name off the team is kept as typed.">
                <OwnerPicker
                  id="p-koProducer"
                  seat="production"
                  value={(project.koProducer as string) ?? ""}
                  staff={staff}
                  disabled={!canEditProject}
                  invalid={bad.includes("koProducer")}
                  onChange={(v) => setP("koProducer", v)}
                />
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Internal notes for production">
                <textarea rows={3} value={(project.koNotes as string) ?? ""}
                  placeholder="Faculty confirmed? Association liaison? Creative dependencies?"
                  onChange={(e) => setP("koNotes", e.target.value)} />
              </Field>
            </div>
            <div className="note" style={{ marginTop: 14 }}>
              Every end date raises a reminder from two days prior, daily until the date itself, to{" "}
              <b>{(entity.coEmail as string) || "admin@onference.in"}</b>, quoting the project name.
              The kick-off document prints the full schedule.
            </div>
          </Card>
        </>
      )}

      {/* ---------------------------------------------------------- content */}
      {tab === "content" && (
        <>
          {selected.size > 0 && (
            <div className="bulkbar" style={{ borderRadius: "var(--r-lg)", marginBottom: 12, border: "1px solid var(--line)" }}>
              <span>{selected.size} selected</span>
              <div className="spacer" />
              <select className="bulkselect" defaultValue=""
                onChange={(e) => { if (e.target.value) { bulkStatus(e.target.value); e.target.value = ""; } }}
                aria-label="Set status">
                <option value="">Set status…</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {role !== "ops" && <Button variant="ghost" size="sm" icon="trash" onClick={bulkDelete}>Remove</Button>}
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}

          {items.length > 0 && (
            <div className="addbar">
              <span className="muted">Add content</span>
              {SECTIONS.map((s) => (
                <Button key={s} variant="secondary" size="sm" icon="plus"
                  onClick={() => addItem(s)} disabled={busy}>
                  {secShort(s)}
                </Button>
              ))}
            </div>
          )}

          {items.length === 0 ? (
            <Card>
              <EmptyState
                icon="projects"
                title="No content added yet"
                description="Add a Daily Pulse, EMA or Media Services line. Each one arrives with its standard inclusions and exclusions already filled in."
                action={(
                  <div className="row" style={{ justifyContent: "center" }}>
                    {SECTIONS.map((s) => (
                      <Button key={s} variant="secondary" icon="plus" onClick={() => addItem(s)} disabled={busy}>
                        {secShort(s)}
                      </Button>
                    ))}
                  </div>
                )}
              />
            </Card>
          ) : (
            <>
              {items.map((it, i) => (
                <ItemCard
                  key={it._id}
                  item={it}
                  index={i}
                  offerings={bySection[it.section] ?? []}
                  offering={offeringOf(it.name)}
                  role={role}
                  showMoney={showMoney}
                  open={it._id === focus ? true : !!expanded[it._id]}
                  focused={it._id === focus}
                  dirty={!!dirty[it._id]}
                  selected={selected.has(it._id)}
                  onSelect={() => setSelected((s) => {
                    const n = new Set(s);
                    if (n.has(it._id)) n.delete(it._id); else n.add(it._id);
                    return n;
                  })}
                  onToggle={() => setExpanded((e) => ({ ...e, [it._id]: !e[it._id] }))}
                  onPatch={(k, v) => patchItem(it._id, k, v)}
                  onOfferingChange={(name) => changeOffering(it._id, name)}
                  onDuplicate={() => duplicateItem(it)}
                  onDelete={() => deleteItem(it._id)}
                  onPropose={() => setProposeFor(it)}
                />
              ))}
            </>
          )}
        </>
      )}

      {/* ---------------------------------------------------------- scheduling */}
      {tab === "scheduling" && (
        <Card padded={false}>
          <SchedulingTable items={items} dirty={dirty} onPatch={patchItem} />
        </Card>
      )}

      {/* ---------------------------------------------------------- commercials */}
      {tab === "commercials" && showMoney && (
        <div className="editor">
          <div>
            <Card title="Tax and terms">
              <div className="grid k3">
                <Field label="GST type">
                  <select value={(project.gstMode as string) ?? "intra"} disabled={!canEditProject}
                    onChange={(e) => setP("gstMode", e.target.value)}>
                    <option value="intra">CGST 9% + SGST 9%</option>
                    <option value="inter">IGST 18%</option>
                  </select>
                </Field>
                <Field label="GST rate (%)" hint="Fixed at 18%.">
                  <input value="18" disabled />
                </Field>
                {F("sac", "SAC code")}
              </div>
              <div style={{ marginTop: 12 }}>
                <Field label="Payment and commercial terms">
                  <textarea rows={4} value={(project.terms as string) ?? ""} disabled={!canEditProject}
                    onChange={(e) => setP("terms", e.target.value)} />
                </Field>
              </div>
            </Card>

            {role === "admin" && (
              <Card title="Issuing entity">
                <div className="grid k2">
                  <Field label="Company name">
                    <input value={(entity.coName as string) ?? ""} onChange={(e) => setE("coName", e.target.value)} />
                  </Field>
                  <Field label="GSTIN">
                    <input value={(entity.coGstin as string) ?? ""} onChange={(e) => setE("coGstin", e.target.value)} />
                  </Field>
                </div>
                <div className="grid k3" style={{ marginTop: 12 }}>
                  <Field label="LLPIN">
                    <input value={(entity.coLlpin as string) ?? ""} onChange={(e) => setE("coLlpin", e.target.value)} />
                  </Field>
                  <Field label="PAN">
                    <input value={(entity.coPan as string) ?? ""} onChange={(e) => setE("coPan", e.target.value)} />
                  </Field>
                  <Field label="TAN">
                    <input value={(entity.coTan as string) ?? ""} onChange={(e) => setE("coTan", e.target.value)} />
                  </Field>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Field label="Udyam Registration No (MSME)" hint="Printed on estimates and invoice requests only.">
                    <input value={(entity.coMsme as string) ?? ""} onChange={(e) => setE("coMsme", e.target.value)} />
                  </Field>
                </div>
                <div className="grid k2" style={{ marginTop: 12 }}>
                  <Field label="Email">
                    <input value={(entity.coEmail as string) ?? ""} onChange={(e) => setE("coEmail", e.target.value)} />
                  </Field>
                  <Field label="Website">
                    <input value={(entity.coSite as string) ?? ""} onChange={(e) => setE("coSite", e.target.value)} />
                  </Field>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Field label="Registered office">
                    <textarea rows={2} value={(entity.coAddr as string) ?? ""} onChange={(e) => setE("coAddr", e.target.value)} />
                  </Field>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Field label="Bank details" hint="Printed on the invoice request only.">
                    <textarea rows={3} value={(entity.coBank as string) ?? ""}
                      placeholder={"Bank name\nA/c no.\nIFSC\nBranch"}
                      onChange={(e) => setE("coBank", e.target.value)} />
                  </Field>
                </div>
              </Card>
            )}
          </div>

          <div className="rail">
            <Card title="Ledger">
              <Ledger
                items={items}
                gstMode={((project.gstMode as string) ?? "intra") as "intra" | "inter"}
                docDiscType={((project.docDiscType as string) ?? "amount") as "amount" | "percent"}
                docDiscValue={num(project.docDiscValue)}
                disabled={!canEditProject}
                onDocDisc={(type, value) => setProject((p) => ({ ...p, docDiscType: type, docDiscValue: value }))}
              />
            </Card>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- documents */}
      {tab === "documents" && (
        <div className="editor">
          <Card title="Generate a document"
            actions={<span className="muted">Preview, then download Word or print to PDF</span>}>
            {DOC_BUTTONS.filter((b) => showMoney || b.key === "kickoff" || b.key === "calendar").map((b) => (
              <button key={b.key} type="button" className="docbtn" onClick={() => openDoc(b.key)}>
                <span className="ic" style={{ background: b.color }}>{b.ic}</span>
                <span>
                  <span className="d1">{b.title}</span>
                  <span className="d2">{b.blurb}</span>
                </span>
              </button>
            ))}
            {role === "ops" && (
              <p className="muted" style={{ marginTop: 12 }}>
                Estimates and invoice requests are hidden for the operations role.
              </p>
            )}
          </Card>

          {showMoney && (
            <div className="rail">
              <Card title="Ledger">
                <Ledger
                  items={items}
                  gstMode={((project.gstMode as string) ?? "intra") as "intra" | "inter"}
                  docDiscType={((project.docDiscType as string) ?? "amount") as "amount" | "percent"}
                  docDiscValue={num(project.docDiscValue)}
                  disabled
                  onDocDisc={() => { }}
                />
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- save bar */}
      {hasChanges && (
        <div className="savebar">
          <span>
            Unsaved changes
            {dirtyIds.length ? ` · ${dirtyIds.length} content ${dirtyIds.length === 1 ? "item" : "items"}` : ""}
          </span>
          <div className="spacer" />
          <Button variant="secondary" onClick={discard} disabled={busy}>Discard</Button>
          <Button onClick={saveAll} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </div>
      )}

      {doc && (
        <DocPreview
          projectId={id}
          type={doc}
          project={project}
          items={items}
          onClose={() => setDoc(null)}
          onPropose={(lineItemId) => {
            // The relay comes from inside the preview iframe, which is a second
            // way into the proposal form that does not pass the card's own
            // button. Refuse it outright when the project carries no
            // commercials, rather than trusting the document not to offer it.
            if (!showMoney) return;
            const it = items.find((x) => x._id === lineItemId);
            if (it) { setDoc(null); setProposeFor(it); }
            else setErr("That card is no longer in the list.");
          }}
          onError={setErr}
          onToast={toast}
        />
      )}

      {/* --------------------------------------------------------- activity */}
      {tab === "activity" && (
        <Card title="Activity"
          actions={<span className="muted">Newest first · last 100 entries</span>}>
          {actErr ? (
            <Banner tone="error">{actErr}</Banner>
          ) : activity === null ? (
            <p className="muted">Loading activity…</p>
          ) : (
            <ActivityFeed entries={activity} />
          )}
        </Card>
      )}

      {proposeFor && (
        <ProposeModal
          project={project}
          item={proposeFor}
          partners={partners}
          onPartnerSaved={(p) => setPartners((l) => {
            const i = l.findIndex((x) => x._id === p._id);
            return i >= 0 ? l.map((x) => (x._id === p._id ? p : x)) : [...l, p];
          })}
          onClose={() => setProposeFor(null)}
          onPreviewHtml={setPropHtml}
          onError={setErr}
          onToast={toast}
        />
      )}

      {propHtml && (
        <div className="overlay" style={{ zIndex: 100 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setPropHtml(""); }}>
          <div className="modal">
            <div className="modal-head">
              <h3>Proposal estimate — preview</h3>
              <div className="spacer" />
              <Button variant="secondary" size="sm" onClick={() => setPropHtml("")}>Close</Button>
            </div>
            <iframe className="pvframe" title="Proposal preview" srcDoc={propHtml} />
          </div>
        </div>
      )}
    </>
  );
}