"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/client";
import { Banner, Button, Card, Field, PageHead } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import type { Role } from "@/lib/rbac";

const ROLE_LABEL: Record<Role, string> = { admin: "Administrator", sales: "Sales", ops: "Operations" };

export interface Profile {
  name: string; username: string; email: string; role: Role;
}

/**
 * Everyone's own profile, whatever their role.
 *
 * Only the two fields that belong to the person are editable. Username is the
 * sign-in handle and role is an administrative decision, so both are shown as
 * read-only facts rather than disabled inputs — a greyed-out box invites
 * someone to try, a stated fact does not.
 */
export default function ProfileView({ initial }: { initial: Profile }) {
  const { update } = useSession();
  const toast = useToast();

  const [p, setP] = useState({ name: initial.name });
  const [saved, setSaved] = useState({ name: initial.name });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwErr, setPwErr] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const dirty = p.name !== saved.name;

  async function saveDetails() {
    setBusy(true); setErr("");
    try {
      await api("/api/profile", { method: "PATCH", body: JSON.stringify(p) });
      setSaved(p);
      // the name rides in the session token, so the topbar would otherwise keep
      // showing the old one until the next sign-in
      await update({ name: p.name });
      toast("Profile saved");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    setPwErr("");
    if (pw.newPassword !== pw.confirm) { setPwErr("The two new passwords do not match."); return; }
    setPwBusy(true);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
      });
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      toast("Password changed");
    } catch (e) {
      setPwErr((e as Error).message);
    } finally {
      setPwBusy(false);
    }
  }

  const pwReady = !!pw.currentPassword && !!pw.newPassword && !!pw.confirm;

  return (
    <>
      <PageHead
        title="Your profile"
        subtitle="Your name as it appears across the CRM and on the documents you generate."
        actions={<Button onClick={saveDetails} disabled={busy || !dirty}>{busy ? "Saving…" : "Save changes"}</Button>}
      />
      {err && <Banner tone="error">{err}</Banner>}

      <Card title="Your details">
        <Field label="Full name" htmlFor="pf-name" required
          hint="Shown in the top bar, on the audit log, and wherever you are named as an owner.">
          <input id="pf-name" value={p.name}
            onChange={(e) => setP((x) => ({ ...x, name: e.target.value }))} />
        </Field>

        <div className="grid k3" style={{ marginTop: 12 }}>
          <div className="fact">
            <div className="k">Username</div>
            <div className="v mono">{initial.username}</div>
          </div>
          <div className="fact">
            <div className="k">Email</div>
            <div className="v">{initial.email || <span className="faint">Not set</span>}</div>
          </div>
          <div className="fact">
            <div className="k">Role</div>
            <div className="v">{ROLE_LABEL[initial.role]}</div>
          </div>
        </div>
        <div className="note" style={{ marginTop: 14 }}>
          You sign in with either your username or your email. Both, and your role,
          are set by an administrator — ask them if your email needs to change.
        </div>
      </Card>

      <Card title="Password">
        {pwErr && <Banner tone="error">{pwErr}</Banner>}
        <div className="grid k3">
          <Field label="Current password" htmlFor="pf-cur">
            <input id="pf-cur" type="password" autoComplete="current-password" value={pw.currentPassword}
              onChange={(e) => setPw((x) => ({ ...x, currentPassword: e.target.value }))} />
          </Field>
          <Field label="New password" htmlFor="pf-new" hint="At least 8 characters.">
            <input id="pf-new" type="password" autoComplete="new-password" value={pw.newPassword}
              onChange={(e) => setPw((x) => ({ ...x, newPassword: e.target.value }))} />
          </Field>
          <Field label="Confirm new password" htmlFor="pf-conf">
            <input id="pf-conf" type="password" autoComplete="new-password" value={pw.confirm}
              onChange={(e) => setPw((x) => ({ ...x, confirm: e.target.value }))} />
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <Button onClick={changePassword} disabled={pwBusy || !pwReady}>
            {pwBusy ? "Changing…" : "Change password"}
          </Button>
        </div>
      </Card>
    </>
  );
}
