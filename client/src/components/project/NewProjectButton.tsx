"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Banner, Button, Field } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Overlay";

/**
 * Creating a project is not free: it reserves the next estimate number from the
 * shared financial-year sequence, and a project abandoned later leaves a gap in
 * the numbering. Hence the confirmation step rather than a bare click.
 */
export default function NewProjectButton({
  basePath, variant = "primary", label = "New project",
}: { basePath: string; variant?: "primary" | "secondary"; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function ask() { setName(""); setErr(""); setOpen(true); }

  async function create() {
    setBusy(true); setErr("");
    try {
      const p = await api<{ _id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ projName: name.trim() || "Untitled project" }),
      });
      router.push(`${basePath}/${p._id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} icon="plus" onClick={ask} className="ctabtn">{label}</Button>

      {open && (
        <Modal
          title="Create a new project?"
          size="sm"
          onClose={() => !busy && setOpen(false)}
          foot={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={create} disabled={busy}>
                {busy ? "Creating…" : "Yes, create project"}
              </Button>
            </>
          }
        >
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              This reserves the next estimate number for the financial year and opens the new
              project straight away. Abandoning it later leaves a gap in the numbering.
            </p>

            <Field label="Project name" htmlFor="np-name"
              hint="Optional — you can set it later on the project page.">
              <input
                id="np-name" value={name} autoFocus
                placeholder="e.g. Femiforte Q3 Awareness Series"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !busy) create(); }}
              />
            </Field>

            {err && <Banner tone="error">{err}</Banner>}
          </div>
        </Modal>
      )}
    </>
  );
}
