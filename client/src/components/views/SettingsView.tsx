"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Banner, Button, Card, Field, PageHead } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";

type Settings = Record<string, string>;

export default function SettingsView({ initial }: { initial: Settings }) {
  const [s, setS] = useState<Settings>(initial);
  const [saved, setSaved] = useState<Settings>(initial);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  function set(k: string, v: string) { setS((x) => ({ ...x, [k]: v })); }

  async function save() {
    setBusy(true); setErr("");
    try {
      await api("/api/settings", { method: "PATCH", body: JSON.stringify(s) });
      setSaved(s);
      toast("Settings saved");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const text = (k: string, label: string, hint?: string) => (
    <Field key={k} label={label} htmlFor={`s-${k}`} hint={hint}>
      <input id={`s-${k}`} value={s[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
    </Field>
  );

  return (
    <>
      <PageHead
        title="Company settings"
        subtitle="These values pre-fill every new project. Changing them here does not rewrite existing projects."
        actions={<Button onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save changes"}</Button>}
      />
      {err && <Banner tone="error">{err}</Banner>}

      <Card title="Issuing entity">
        <div className="grid k2">
          {text("coName", "Company name")}
          {text("coGstin", "GSTIN")}
        </div>
        <div className="grid k3" style={{ marginTop: 12 }}>
          {text("coLlpin", "LLPIN")}
          {text("coPan", "PAN")}
          {text("coTan", "TAN")}
        </div>
        <div style={{ marginTop: 12 }}>
          {text("coMsme", "Udyam Registration No (MSME)", "Printed on estimates and invoice requests only.")}
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Registered office" htmlFor="s-coAddr">
            <textarea id="s-coAddr" rows={2} value={s.coAddr ?? ""} onChange={(e) => set("coAddr", e.target.value)} />
          </Field>
        </div>
        <div className="grid k2" style={{ marginTop: 12 }}>
          {text("coEmail", "Email", "Reminder emails are addressed here.")}
          {text("coSite", "Website")}
        </div>
      </Card>

      <Card title="Commercial defaults">
        <div className="grid k2">
          {text("defaultSac", "SAC code", "Printed on estimates and invoice requests.")}
          {text("defaultValidity", "Estimate validity (days)")}
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Payment and commercial terms" htmlFor="s-terms"
            hint="Copied into the terms box of every new project.">
            <textarea id="s-terms" rows={5} value={s.defaultTerms ?? ""}
              onChange={(e) => set("defaultTerms", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card title="Banking">
        <Field label="Remittance details" htmlFor="s-coBank"
          hint="Appears on the invoice request only, never on a client-facing estimate.">
          <textarea id="s-coBank" rows={4} value={s.coBank ?? ""}
            onChange={(e) => set("coBank", e.target.value)}
            placeholder={"Bank name\nA/c no.\nIFSC\nBranch"} />
        </Field>
      </Card>

      {dirty && (
        <div className="savebar">
          <span>You have unsaved changes.</span>
          <div className="spacer" />
          <Button variant="secondary" onClick={() => setS(saved)}>Discard</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </div>
      )}
    </>
  );
}
