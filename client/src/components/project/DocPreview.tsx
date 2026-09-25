"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toLocalISO } from "@/lib/defaults";
import { money, toWords, totals as computeTotals, GST_RATE } from "@/lib/money";
import { fmtDate } from "@/features/documents/templates/shared";
import { Button } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Overlay";
import type { Item, ProjectMap } from "./types";

export type DocType = "estimate" | "kickoff" | "invoice" | "calendar";

const TITLES: Record<DocType, string> = {
  estimate: "Estimate", kickoff: "Kick off",
  invoice: "Invoice request", calendar: "Content calendar",
};

/** The calendar is a working view, not something anyone emails as a document. */
const EMAILABLE: DocType[] = ["estimate", "kickoff", "invoice"];

interface Props {
  projectId: string;
  type: DocType;
  project: ProjectMap;
  items: Item[];
  onClose: () => void;
  onPropose: (lineItemId: string) => void;
  onError: (msg: string) => void;
  onToast: (msg: string) => void;
}

function download(blob: Blob, cd: string | null, fallback: string) {
  const m = (cd || "").match(/filename="(.+?)"/);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = m ? m[1] : fallback;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

export default function DocPreview(p: Props) {
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState(false);
  const [calView, setCalView] = useState<"kanban" | "calendar">("kanban");
  const [calMonth, setCalMonth] = useState(toLocalISO(new Date()).slice(0, 7));
  const frame = useRef<HTMLIFrameElement>(null);

  const body = useCallback(
    (mode: "preview" | "word") => JSON.stringify({
      projectId: p.projectId, type: p.type, mode, calView, calMonth,
    }),
    [p.projectId, p.type, calView, calMonth]
  );

  useEffect(() => {
    let stale = false;
    setBusy(true);
    fetch("/api/documents/generate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: body("preview"),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Preview failed");
        return res.text();
      })
      .then((t) => { if (!stale) { setHtml(t); setBusy(false); } })
      .catch((e) => { if (!stale) { setBusy(false); p.onError((e as Error).message); } });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  // Propose clicks are relayed from inside the iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as { onfPropose?: string } | null;
      if (!data || typeof data.onfPropose !== "string") return;
      if (frame.current && e.source !== frame.current.contentWindow) return;
      p.onPropose(data.onfPropose);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  });

  async function downloadWord() {
    setWorking(true);
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: body("word"),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Download failed");
      download(await res.blob(), res.headers.get("Content-Disposition"), `${p.type}.doc`);
      p.onToast(`${TITLES[p.type]} downloaded`);
    } catch (e) { p.onError((e as Error).message); }
    finally { setWorking(false); }
  }

  // async function downloadICS() {
  //   setWorking(true);
  //   try {
  //     const res = await fetch(`/api/documents/ics?projectId=${p.projectId}`);
  //     if (!res.ok) throw new Error("Reminders could not be generated.");
  //     const blob = await res.blob();
  //     if (blob.size < 60) { p.onToast("No end dates set yet, so there is nothing to remind about."); return; }
  //     download(blob, res.headers.get("Content-Disposition"), "reminders.ics");
  //     p.onToast("Reminders downloaded");
  //   } catch (e) { p.onError((e as Error).message); }
  //   finally { setWorking(false); }
  // }

  function print() {
    const w = frame.current?.contentWindow;
    if (w) { w.focus(); w.print(); }
  }

  /**
   * Opens the reader's own mail client with the covering note already written.
   * The document itself still has to be attached by hand — mailto cannot carry
   * an attachment — so every variant says so and the toast repeats it.
   *
   * Recipient follows who the document is actually addressed to: the estimate
   * is client-facing, while the kick off ("not for circulation outside
   * Onference") and the invoice request ("for finance") are internal.
   */
  function draftEmail() {
    const s = (v: unknown) => String(v ?? "").trim();
    const pr = p.project;
    const co = (pr.entity ?? {}) as Record<string, string>;
    const projName = s(pr.projName) || "Untitled project";
    const estNo = s(pr.estNo);
    const ref = estNo ? ` (${estNo})` : "";

    const t = computeTotals({
      items: p.items.map((i) => ({
        qty: i.qty, rate: i.rate, discType: i.discType,
        discValue: i.discValue, amountOverride: i.amountOverride,
      })),
      docDiscType: (s(pr.docDiscType) || "amount") as "amount" | "percent",
      docDiscValue: Number(pr.docDiscValue) || 0,
      gstMode: (s(pr.gstMode) || "intra") as "intra" | "inter",
    });
    const gstLine = s(pr.gstMode) === "inter"
      ? `IGST ${GST_RATE}%: ${money(t.igst)}`
      : `CGST ${GST_RATE / 2}% + SGST ${GST_RATE / 2}%: ${money(t.cgst + t.sgst)}`;
    const amounts = [
      `Sub-total: ${money(t.sub)}`,
      gstLine,
      `Grand total: ${money(t.total)}`,
      `(${toWords(t.total)})`,
    ];
    const signoff = [
      co.coName || "Onference Training Technologies LLP",
      (co.coEmail || "") + (co.coSite ? ` | ${co.coSite}` : ""),
    ];
    const line = (k: string, v: string) => `${k}: ${v || "—"}`;

    let to = "";
    let subject = "";
    let lines: string[] = [];

    if (p.type === "estimate") {
      to = s(pr.cEmail);
      subject = `Estimate${ref} — ${projName}`;
      lines = [
        `Dear ${s(pr.cContact) || s(pr.cName) || "Sir/Madam"},`, "",
        `Please find attached our estimate for ${projName}.`, "",
        line("Estimate no.", estNo),
        line("Date", s(pr.date) ? fmtDate(s(pr.date)) : ""),
        line("Valid for", s(pr.validity) ? `${s(pr.validity)} days` : ""),
        line("Place of supply", s(pr.pos)), "",
        ...amounts, "",
        ...(s(pr.terms) ? [s(pr.terms), ""] : []),
        "The formal estimate is attached.", "",
        "Warm regards,", ...signoff,
      ];
    } else if (p.type === "invoice") {
      to = co.coEmail || "";
      subject = `Invoice request${ref} — ${projName}`;
      lines = [
        "Hi Finance,", "",
        "Please raise a tax invoice against the details below.", "",
        line("Partner", s(pr.cName)),
        line("Partner GSTIN", s(pr.cGstin)),
        line("Place of supply", s(pr.pos)),
        line("Partner PO / reference", s(pr.cPo)),
        line("Linked estimate no.", estNo),
        line("Date", s(pr.date) ? fmtDate(s(pr.date)) : ""), "",
        ...amounts, "",
        "The invoice request is attached.", "",
        signoff[0],
      ];
    } else {
      to = co.coEmail || "";
      subject = `Kick off${ref} — ${projName}`;
      lines = [
        "Hi team,", "",
        `Kick-off details for ${projName}${s(pr.cName) ? ` with ${s(pr.cName)}` : ""}.`, "",
        line("Project start", s(pr.koStart) ? fmtDate(s(pr.koStart)) : ""),
        line("Project end", s(pr.koEnd) ? fmtDate(s(pr.koEnd)) : ""),
        line("Contract", s(pr.koContract)),
        line("Account owner", s(pr.koOwner)),
        line("Production owner", s(pr.koProducer)),
        line("Content items", String(p.items.length)),
        ...(s(pr.koNotes) ? ["", "Notes:", s(pr.koNotes)] : []), "",
        "The kick-off document is attached.", "",
        signoff[0],
      ];
    }

    const a = document.createElement("a");
    a.href = "mailto:" + encodeURIComponent(to)
      + "?subject=" + encodeURIComponent(subject)
      + "&body=" + encodeURIComponent(lines.join("\n"));
    a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    p.onToast("Email drafted — download the Word file to attach it");
  }

  return (
    <Modal
      title={`${TITLES[p.type]} — preview`}
      onClose={p.onClose}
      bodyClass=""
      head={
        p.type === "calendar" ? (
          <>
            <Button variant={calView === "kanban" ? "primary" : "secondary"} size="sm"
              onClick={() => setCalView("kanban")}>Kanban</Button>
            <Button variant={calView === "calendar" ? "primary" : "secondary"} size="sm"
              onClick={() => setCalView("calendar")}>Month grid</Button>
            <input type="month" value={calMonth} onChange={(e) => setCalMonth(e.target.value)}
              style={{ width: "auto", height: 27 }} aria-label="Calendar month" />
          </>
        ) : undefined
      }
      foot={
        <>
          <Button variant="secondary" icon="file" onClick={print} disabled={working}>Print / PDF</Button>
          <Button variant="secondary" icon="download" onClick={downloadWord} disabled={working}>
            {working ? "Preparing…" : "Word"}
          </Button>
          {EMAILABLE.includes(p.type) && (
            <Button onClick={draftEmail} disabled={working}>Draft email</Button>
          )}
        </>
      }
    >
      <iframe
        ref={frame} className="pvframe" title="Document preview"
        srcDoc={busy
          ? "<p style='font:14px Arial;padding:28px;color:#63718A'>Building preview…</p>"
          : html}
      />
    </Modal>
  );
}
