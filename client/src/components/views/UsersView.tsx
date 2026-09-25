"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import DataTable, { type Column } from "@/components/ui/DataTable";
import { Badge, Banner, Button, Field, PageHead } from "@/components/ui/primitives";
import { Drawer, Tabs } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import DeleteUserDialog, { type Owned } from "@/components/users/DeleteUserDialog";

export interface UserRow {
  _id: string; username: string; name: string; email: string; role: string; active: boolean;
  /** What the account still owns, counted server-side for the delete dialog. */
  owned?: Owned;
}

const BLANK = { username: "", name: "", email: "", role: "sales", password: "" };
type Form = typeof BLANK;

const ROLES = [
  { value: "admin", label: "Administrator", blurb: "Full access, including users and settings." },
  { value: "sales", label: "Sales", blurb: "Projects, partners and commercial documents." },
  { value: "ops", label: "Operations", blurb: "Production scheduling. Never sees pricing." },
];

const roleTone = (r: string) => (r === "admin" ? "info" : r === "sales" ? "ok" : "neutral");

export default function UsersView({ rows, currentUserId }: { rows: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(BLANK);
  const [err, setErr] = useState("");
  const [pageErr, setPageErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("active");
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  function set(k: keyof Form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function create() {
    if (!form.username.trim() || !form.password) { setErr("Username and password are both required."); return; }
    setBusy(true); setErr("");
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify(form) });
      setOpen(false); setForm(BLANK);
      toast("User created");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** The ordinary delete: reversible, and everything they own stays attributed. */
  async function softDelete(u: UserRow) {
    const ok = await confirm({
      title: `Delete ${u.username}?`,
      body: (
        <>
          They lose access immediately and move to <b>Deleted</b>. Everything they
          own stays exactly where it is, and you can restore the account from there.
        </>
      ),
      confirmLabel: "Delete user",
      danger: true,
    });
    if (!ok) return;
    setPageErr("");
    try {
      await api(`/api/users/${u._id}`, { method: "DELETE" });
      toast(`${u.username} deleted`);
      router.refresh();
    } catch (e) { setPageErr((e as Error).message); }
  }

  async function restore(u: UserRow) {
    setPageErr("");
    try {
      await api(`/api/users/${u._id}`, { method: "PATCH", body: JSON.stringify({ active: true }) });
      toast(`${u.username} restored`);
      router.refresh();
    } catch (e) { setPageErr((e as Error).message); }
  }

  const columns: Column<UserRow>[] = [
    {
      key: "name", header: "User", sortable: true,
      render: (u) => (
        <>
          <div style={{ fontWeight: 600 }}>
            {u.name || u.username}
            {u._id === currentUserId && <span className="faint"> · you</span>}
          </div>
          <div className="faint mono">{u.username}</div>
        </>
      ),
    },
    { key: "email", header: "Email", sortable: true, render: (u) => u.email || <span className="faint">—</span> },
    {
      key: "role", header: "Role", sortable: true, width: "160px",
      render: (u) => <Badge tone={roleTone(u.role)}>{ROLES.find((r) => r.value === u.role)?.label ?? u.role}</Badge>,
    },
    {
      key: "active", header: "Status", sortable: true, width: "120px",
      render: (u) => <Badge tone={u.active ? "ok" : "neutral"} dot>{u.active ? "Active" : "Deleted"}</Badge>,
    },
  ];

  const active = rows.filter((u) => u.active);
  const deleted = rows.filter((u) => !u.active);
  const shown = tab === "active" ? active : deleted;

  // anyone still signed-in-able can inherit, except the account being removed
  const heirs = active
    .filter((u) => u._id !== deleting?._id)
    .map((u) => ({ _id: u._id, name: u.name, username: u.username, role: u.role }));

  return (
    <>
      <PageHead
        title="Users"
        subtitle="Who can sign in, and what each of them may see."
        actions={<Button icon="plus" onClick={() => { setForm(BLANK); setErr(""); setOpen(true); }}>Add user</Button>}
      />
      {pageErr && <Banner tone="error">{pageErr}</Banner>}

      <Tabs
        tabs={[
          { key: "active", label: "Active", count: active.length },
          { key: "deleted", label: "Deleted", count: deleted.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <DataTable
        key={tab}
        rows={shown}
        columns={columns}
        rowKey={(u) => u._id}
        rowActions={(u) => {
          const isSelf = u._id === currentUserId;
          if (isSelf) return null;
          // an admin may not remove another admin
          const removable = u.role !== "admin";
          if (u.active) {
            return removable
              ? <Button variant="danger" size="sm" onClick={() => softDelete(u)}>Delete</Button>
              : null;
          }
          return (
            <>
              <Button variant="ghost" size="sm" onClick={() => restore(u)}>Restore</Button>
              {removable && (
                <Button variant="danger" size="sm" onClick={() => setDeleting(u)}>Delete forever</Button>
              )}
            </>
          );
        }}
        empty={tab === "active"
          ? { title: "No active users", description: "Add an account to get started." }
          : { title: "Nothing deleted", description: "Deleted accounts appear here and can be restored." }}
      />

      {deleting && (
        <DeleteUserDialog
          user={deleting}
          candidates={heirs}
          onClose={() => setDeleting(null)}
          onDone={(msg) => { setDeleting(null); toast(msg); router.refresh(); }}
        />
      )}

      {open && (
        <Drawer
          title="Add user"
          onClose={() => setOpen(false)}
          foot={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={busy}>{busy ? "Creating…" : "Create user"}</Button>
            </>
          }
        >
          <div className="stack">
            {err && <Banner tone="error">{err}</Banner>}
            <Field label="Username" required htmlFor="u-username" hint="Used to sign in. Lowercase, no spaces.">
              <input id="u-username" value={form.username} autoFocus autoCapitalize="off" spellCheck={false}
                onChange={(e) => set("username", e.target.value)} />
            </Field>
            <Field label="Full name" htmlFor="u-name">
              <input id="u-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="u-email">
              <input id="u-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Role" htmlFor="u-role"
              hint={ROLES.find((r) => r.value === form.role)?.blurb}>
              <select id="u-role" value={form.role} onChange={(e) => set("role", e.target.value)}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Password" required htmlFor="u-password" hint="Share it with them directly; it is stored hashed.">
              <input id="u-password" type="password" value={form.password}
                onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
        </Drawer>
      )}
    </>
  );
}
