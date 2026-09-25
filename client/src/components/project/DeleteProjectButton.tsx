"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Banner, Button, Field } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";

/**
 * Deleting a project is a hard delete: the record and every content item under
 * it are removed from the database, and nothing archives them first. So the
 * dialog spells out the consequences and asks for the name to be typed —
 * the row action sits one pixel from "open project", and a misclick here is
 * not recoverable from the UI.
 */
export default function DeleteProjectButton({
  id, name, estNo, itemCount = 0, label, size = "sm", onDeleted,
}: {
  id: string;
  name: string;
  estNo?: string;
  itemCount?: number;
  label?: string;
  size?: "sm" | "lg";
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const title = name.trim() || "Untitled project";
  const confirmed = typed.trim().toLowerCase() === title.toLowerCase();

  function ask() { setTyped(""); setErr(""); setOpen(true); }

  async function remove() {
    if (!confirmed) return;
    setBusy(true); setErr("");
    try {
      await api(`/api/projects/${id}`, { method: "DELETE" });
      setOpen(false);
      setBusy(false);
      toast(`“${title}” deleted`);
      onDeleted?.();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      {label ? (
        <Button variant="danger" size={size} icon="trash" onClick={ask}>{label}</Button>
      ) : (
        <Button variant="ghost" size={size} icon="trash" onClick={ask}
          className="danger-hover" aria-label={`Delete ${title}`} title={`Delete ${title}`} />
      )}

      {open && (
        <Modal
          title="Delete this project?"
          size="sm"
          onClose={() => !busy && setOpen(false)}
          foot={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button variant="danger" onClick={remove} disabled={busy || !confirmed}>
                {busy ? "Deleting…" : "Delete permanently"}
              </Button>
            </>
          }
        >
          <div className="stack">
            <Banner tone="error">This cannot be undone. There is no archive and no restore.</Banner>

            <p style={{ margin: 0 }}>
              You are about to delete <strong>{title}</strong>
              {estNo ? <> (<span className="mono">{estNo}</span>)</> : null}. Here is what happens:
            </p>

            <ul className="conseq">
              <li>
                The project and its{" "}
                <strong>{itemCount} content {itemCount === 1 ? "item" : "items"}</strong>{" "}
                are erased from the database — topics, statuses, dates and rates alike.
              </li>
              {estNo && (
                <li>
                  Estimate number <span className="mono">{estNo}</span> is retired. The
                  financial-year sequence keeps counting, so this number is never reissued and
                  leaves a permanent gap in the numbering.
                </li>
              )}
              <li>
                Its content disappears from the calendar and stops counting towards dashboard
                totals, including revenue figures.
              </li>
              <li>
                Documents already generated and sent — estimate, kick-off, invoice request — are
                <strong> not</strong> recalled. Anyone holding a copy keeps it, and finance may
                already have raised a tax invoice against it.
              </li>
              <li>The deletion is recorded in the audit log against your name.</li>
            </ul>

            <Field label={`Type “${title}” to confirm`} htmlFor="del-confirm">
              <input
                id="del-confirm" value={typed} autoFocus autoComplete="off"
                placeholder={title}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && confirmed && !busy) remove(); }}
              />
            </Field>

            {err && <Banner tone="error">{err}</Banner>}
          </div>
        </Modal>
      )}
    </>
  );
}
