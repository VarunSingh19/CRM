"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { money, num, toWords, totals as computeTotals, GST_RATE } from "@/lib/money";
import { PARTNER_TYPES, secShort, topicOf } from "@/lib/defaults";
import { fmtDate } from "@/features/documents/templates/shared";
import { Badge, Banner, Button, Field } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Overlay";
import type { Item, PartnerRow, ProjectMap } from "./types";

interface PartnerForm {
  name: string; type: string; email: string; mobile: string;
  contact: string; gstin: string; addr: string;
}
const BLANK: PartnerForm = { name: "", type: "", email: "", mobile: "", contact: "", gstin: "", addr: "" };

interface Props {
  project: ProjectMap;
  item: Item;
  partners: PartnerRow[];
  onPartnerSaved: (p: PartnerRow) => void;
  onClose: () => void;
  onPreviewHtml: (html: string) => void;
  onError: (msg: string) => void;
  onToast: (msg: string) => void;
}

/** Quote one card to any partner, priced independently of the project itself. */
export default function ProposeModal(p: Props) {
  const [pick, setPick] = useState("current");
  const [form, setForm] = useState<PartnerForm>(BLANK);
  const [qty, setQty] = useState(p.item.qty);
  const [rate, setRate] = useState(p.item.rate);
  const [discType, setDiscType] = useState<"amount" | "percent">(p.item.discType);
  const [discValue, setDiscValue] = useState(p.item.discValue);
  const [bad, setBad] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const currentPartner = useMemo<PartnerForm>(() => ({
    name: (p.project.cName as string) ?? "", type: (p.project.partnerType as string) ?? "",
    email: (p.project.cEmail as string) ?? "", mobile: (p.project.cMobile as string) ?? "",
    contact: (p.project.cContact as string) ?? "", gstin: (p.project.cGstin as string) ?? "",
    addr: (p.project.cAddr as string) ?? "",
  }), [p.project]);

  useEffect(() => { setForm(currentPartner); }, [currentPartner]);

  const gstMode = ((p.project.gstMode as string) ?? "intra") as "intra" | "inter";
  const t = computeTotals({
    items: [{ qty, rate, discType, discValue, amountOverride: "" }],
    docDiscType: "amount", docDiscValue: 0, gstMode,
  });

  function set(k: keyof PartnerForm, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function onPick(v: string) {
    setPick(v);
    if (v === "current") setForm(currentPartner);
    else if (v === "new") setForm(BLANK);
    else {
      const row = p.partners[parseInt(v, 10)];
      if (row) setForm({
        name: row.name ?? "", type: row.type ?? "", email: row.email ?? "", mobile: row.mobile ?? "",
        contact: row.contact ?? "", gstin: row.gstin ?? "", addr: row.addr ?? "",
      });
    }
  }

  function validate(): boolean {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push("name");
    if (!form.email.trim()) missing.push("email");
    if (!form.type.trim()) missing.push("type");
    setBad(missing);
    setErr(missing.length ? `Partner ${missing.join(", ")} required.` : "");
    return missing.length === 0;
  }

  const payload = (mode: "preview" | "word") => JSON.stringify({
    projectId: String(p.project._id), lineItemId: p.item._id, mode, gstMode,
    partner: form, override: { qty, rate, discType, discValue },
  });

  async function call(mode: "preview" | "word") {
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/documents/proposal", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: payload(mode),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Request failed");
      if (mode === "preview") {
        p.onPreviewHtml(await res.text());
      } else {
        const cd = res.headers.get("Content-Disposition") || "";
        const m = cd.match(/filename="(.+?)"/);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(await res.blob());
        a.download = m ? m[1] : "proposal.doc";
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        p.onToast("Proposal downloaded — attach it to the email");
      }
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function savePartner() {
    if (!validate()) return;
    const existing = p.partners.find((x) => x.name.toLowerCase() === form.name.trim().toLowerCase());
    try {
      const saved = existing
        ? await api<PartnerRow>(`/api/partners/${existing._id}`, { method: "PATCH", body: JSON.stringify(form) })
        : await api<PartnerRow>("/api/partners", { method: "POST", body: JSON.stringify(form) });
      p.onPartnerSaved(saved);
      p.onToast(existing ? "Partner updated" : "Partner saved");
    } catch (e) { setErr((e as Error).message); }
  }

  function draftEmail() {
    if (!validate()) return;
    const it = p.item;
    const tp = topicOf(it) || it.projDesc || it.name;
    const co = (p.project.entity ?? {}) as Record<string, string>;
    const subject = `Proposal — ${(p.project.projName as string) || "Onference TV"} — ${tp}`;
    const gstLine = gstMode === "inter"
      ? `IGST ${GST_RATE}%: ${money(t.igst)}`
      : `CGST ${GST_RATE / 2}% + SGST ${GST_RATE / 2}%: ${money(t.cgst + t.sgst)}`;
    const body = [
      `Dear ${form.contact || form.name},`, "",
      "Please find below our proposal for the following Onference TV content.", "",
      `Content: ${tp}`,
      `Offering: ${it.name} (${secShort(it.section)})`,
      `Card type: ${it.cardType || "Not applicable"}`,
      `Release date: ${it.relDate ? fmtDate(it.relDate) : "To be confirmed"}`,
      `Duration: ${it.duration || "—"}`, "",
      `Quantity: ${qty}`,
      `Rate: ${money(num(rate))}`,
      `Sub-total: ${money(t.sub)}`,
      gstLine,
      `Grand total: ${money(t.total)}`,
      `(${toWords(t.total)})`, "",
      `Reference: ${(p.project.estNo as string) || "—"}`, "",
      (p.project.terms as string) ? `${p.project.terms as string}\n` : "",
      "The formal estimate is attached.", "", "Warm regards,",
      co.coName || "Onference Training Technologies LLP",
      (co.coEmail || "") + (co.coSite ? ` | ${co.coSite}` : ""),
    ].join("\n");

    const a = document.createElement("a");
    a.href = "mailto:" + encodeURIComponent(form.email)
      + "?subject=" + encodeURIComponent(subject)
      + "&body=" + encodeURIComponent(body);
    a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    p.onToast("Email drafted — download the Word file to attach it");
  }

  const it = p.item;
  const tp = topicOf(it) || it.projDesc || it.name;

  return (
    <Modal
      title="Propose this content to a partner"
      size="md"
      onClose={p.onClose}
      foot={
        <>
          <Button variant="secondary" onClick={savePartner} disabled={busy}>Save partner</Button>
          <Button variant="secondary" onClick={() => call("preview")} disabled={busy}>Preview</Button>
          <Button variant="secondary" icon="download" onClick={() => call("word")} disabled={busy}>Word</Button>
          <Button onClick={draftEmail} disabled={busy}>Draft email</Button>
        </>
      }
    >
      <div className="stack">
        <div className="selcard" style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: 12 }}>
          <div className="row" style={{ marginBottom: 4 }}>
            <Badge tone="neutral">{secShort(it.section)}</Badge>
            <Badge tone="info">{it.cardType || "Not applicable"}</Badge>
            <span className="faint">Release {it.relDate ? fmtDate(it.relDate) : "not set"}</span>
          </div>
          <div style={{ fontWeight: 650 }}>{tp}</div>
          <div className="faint">{it.name}</div>
        </div>

        {err && <Banner tone="error">{err}</Banner>}

        <Field label="Partner" hint="Pick a saved partner, reuse this project's, or enter a new one below.">
          <select value={pick} onChange={(e) => onPick(e.target.value)}>
            <option value="current">Partner from this project</option>
            {p.partners.map((row, i) => (
              <option key={row._id} value={String(i)}>{row.name}{row.type ? ` — ${row.type}` : ""}</option>
            ))}
            <option value="new">New partner…</option>
          </select>
        </Field>

        <div className="grid k2">
          <Field label="Partner name" required error={bad.includes("name") ? "Required" : undefined}>
            <input value={form.name} className={bad.includes("name") ? "bad" : ""}
              onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Partner type" required error={bad.includes("type") ? "Required" : undefined}>
            <select value={form.type} className={bad.includes("type") ? "bad" : ""}
              onChange={(e) => set("type", e.target.value)}>
              <option value="">Select…</option>
              {PARTNER_TYPES.map((t2) => <option key={t2} value={t2}>{t2}</option>)}
            </select>
          </Field>
          <Field label="Partner email" required error={bad.includes("email") ? "Required" : undefined}>
            <input type="email" value={form.email} className={bad.includes("email") ? "bad" : ""}
              onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Partner mobile">
            <input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
          </Field>
          <Field label="Contact person">
            <input value={form.contact} onChange={(e) => set("contact", e.target.value)} />
          </Field>
          <Field label="Partner GSTIN">
            <input value={form.gstin} onChange={(e) => set("gstin", e.target.value)} />
          </Field>
        </div>
        <Field label="Partner address">
          <textarea rows={2} value={form.addr} onChange={(e) => set("addr", e.target.value)} />
        </Field>

        <div className="section-label">Commercials for this proposal</div>
        <div className="grid k4">
          <Field label="Quantity">
            <input type="number" min={0} step={1} value={qty} onChange={(e) => setQty(num(e.target.value))} />
          </Field>
          <Field label="Rate (₹)">
            <input type="number" min={0} step={0.01} value={rate} onChange={(e) => setRate(num(e.target.value))} />
          </Field>
          <Field label="Discount">
            <div className="split">
              <select value={discType} onChange={(e) => setDiscType(e.target.value as "amount" | "percent")}>
                <option value="amount">₹</option>
                <option value="percent">%</option>
              </select>
              <input type="number" min={0} step={0.01} value={discValue}
                onChange={(e) => setDiscValue(num(e.target.value))} />
            </div>
          </Field>
          <Field label="Grand total" hint={gstMode === "inter" ? "Includes IGST 18%" : "Includes CGST + SGST"}>
            <input value={money(t.total)} disabled />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
