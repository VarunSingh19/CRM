"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Modal } from "@/components/ui/Overlay";
import { Banner, Button, Field } from "@/components/ui/primitives";

export interface Owned { projects: number; partners: number; proposals: number }

export interface DeletableUser {
  _id: string; username: string; name: string; role: string; owned?: Owned;
}

/** "5 projects, 13 partners" — only the parts that are actually non-zero. */
function describe(o: Owned): string {
  return ([
    [o.projects, "project"], [o.partners, "partner"], [o.proposals, "proposal"],
  ] as [number, string][])
    .filter(([n]) => n > 0)
    .map(([n, w]) => `${n} ${w}${n === 1 ? "" : "s"}`)
    .join(", ");
}

/**
 * The last step before an account is gone for good.
 *
 * When the account owns nothing this is just a confirmation. When it owns work,
 * the question that matters is what happens to that work, so it is asked here
 * rather than refused: hand it to a named colleague, or knowingly leave it
 * behind. Leaving it behind is legitimate — an account created by mistake may
 * own records nobody wants — but it has a consequence worth reading, so it is
 * spelled out instead of being the quiet default.
 */
export default function DeleteUserDialog({
  user, candidates, onClose, onDone,
}: {
  user: DeletableUser;
  /** Who may inherit: everyone still active, minus the account being removed. */
  candidates: { _id: string; name: string; username: string; role: string }[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const owned = user.owned ?? { projects: 0, partners: 0, proposals: 0 };
  const total = owned.projects + owned.partners + owned.proposals;

  const [mode, setMode] = useState<"reassign" | "leave">(total > 0 ? "reassign" : "leave");
  const [heir, setHeir] = useState(candidates[0]?._id ?? "");
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const nameMatches = typed.trim() === user.username;
  const needsHeir = total > 0 && mode === "reassign";
  const ready = nameMatches && (!needsHeir || !!heir) && !busy;

  async function go() {
    setBusy(true); setErr("");
    try {
      const q = needsHeir ? `?hard=1&reassignTo=${encodeURIComponent(heir)}` : "?hard=1";
      const res = await api<{ moved?: number; reassignedTo?: string | null }>(
        `/api/users/${user._id}${q}`, { method: "DELETE" }
      );
      onDone(
        res?.reassignedTo
          ? `${user.username} deleted — ${res.moved} record${res.moved === 1 ? "" : "s"} moved to ${res.reassignedTo}`
          : `${user.username} deleted`
      );
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Permanently delete ${user.username}?`}
      size="sm"
      onClose={onClose}
      foot={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!ready} onClick={go}>
            {busy ? "Deleting…" : "Delete account"}
          </Button>
        </>
      }
    >
      <div className="stack">
        {err && <Banner tone="error">{err}</Banner>}

        <div className="confirm-body">
          This cannot be undone. The audit trail keeps what {user.name || user.username} did.
        </div>

        {total > 0 && (
          <fieldset className="choice">
            <legend>
              They still own <b>{describe(owned)}</b>. What should happen to it?
            </legend>

            <label className={mode === "reassign" ? "on" : ""}>
              <input
                type="radio" name="del-mode" checked={mode === "reassign"}
                onChange={() => setMode("reassign")}
              />
              <span>
                <b>Hand it to a colleague</b> — everything moves across, nothing is orphaned.
              </span>
            </label>

            {mode === "reassign" && (
              <div className="choice-extra">
                <Field label="New owner" htmlFor="del-heir">
                  <select id="del-heir" value={heir} onChange={(e) => setHeir(e.target.value)}>
                    {candidates.length === 0 && <option value="">No other active accounts</option>}
                    {candidates.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name || c.username} · {c.role}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <label className={mode === "leave" ? "on" : ""}>
              <input
                type="radio" name="del-mode" checked={mode === "leave"}
                onChange={() => setMode("leave")}
              />
              <span>
                <b>Leave the records as they are</b> — they stay visible to admins and
                operations, but drop out of any sales user&rsquo;s own list.
              </span>
            </label>
          </fieldset>
        )}

        <label className="confirm-verify">
          <span className="lbl">Type <b>{user.username}</b> to confirm</span>
          <input
            data-autofocus
            value={typed}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={typed.length > 0 && !nameMatches}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && ready) go(); }}
          />
        </label>
      </div>
    </Modal>
  );
}
