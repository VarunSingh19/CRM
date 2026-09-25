"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PERIOD_OPTIONS, type PeriodKey } from "@/lib/period";
import { Button } from "@/components/ui/primitives";
import Icon from "@/components/ui/Icon";

/**
 * One control, not three. The period lives in the URL so a filtered dashboard
 * can be shared or bookmarked, and so the server renders the right numbers on
 * first paint. Custom range is a panel inside the same menu rather than loose
 * date inputs sitting in the page header.
 */
export default function PeriodFilter({
  periodKey, label, from, to,
}: { periodKey: PeriodKey; label: string; from?: string; to?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(periodKey === "custom");
  const [draftFrom, setDraftFrom] = useState(from ?? "");
  const [draftTo, setDraftTo] = useState(to ?? "");
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => { setDraftFrom(from ?? ""); setDraftTo(to ?? ""); }, [from, to]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function apply(next: Record<string, string | undefined>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) q.set(k, v); else q.delete(k);
    }
    const qs = q.toString();
    startTransition(() => router.replace(qs ? `?${qs}` : "?", { scroll: false }));
  }

  function pick(key: PeriodKey) {
    if (key === "custom") { setCustom(true); return; }   // stay open, reveal the panel
    setCustom(false);
    setOpen(false);
    apply({ period: key === "all" ? undefined : key, from: undefined, to: undefined });
  }

  function applyCustom() {
    if (!draftFrom && !draftTo) return;
    setOpen(false);
    apply({ period: "custom", from: draftFrom || undefined, to: draftTo || undefined });
  }

  // a backwards range is a user slip, not an error worth a banner
  const invalid = !!draftFrom && !!draftTo && draftFrom > draftTo;

  return (
    <div className="periodwrap" ref={wrap}>
      <button type="button" className="periodbtn" onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu" aria-expanded={open}>
        <span className="ico"><Icon name="calendar" size={15} /></span>
        <span>{busy ? "Updating…" : label}</span>
        <Icon name="chevronDown" size={14} />
      </button>

      {open && (
        <>
        {/* backdrop only paints on small screens, where the menu is a sheet */}
        <div className="sheetbg" onClick={() => setOpen(false)} aria-hidden="true" />
        <div className="periodmenu" role="menu">
          <div className="sheetgrip" aria-hidden="true" />
          <div className="sheettitle">Reporting period</div>
          {PERIOD_OPTIONS.filter((o) => o.key !== "custom").map((o) => (
            <button key={o.key} type="button" role="menuitem"
              className={`opt ${periodKey === o.key ? "on" : ""}`}
              onClick={() => pick(o.key)}>
              {o.label}
              {periodKey === o.key && <span className="tick"><Icon name="check" size={14} /></span>}
            </button>
          ))}

          <div className="sep" />

          <button type="button" role="menuitem"
            className={`opt ${custom || periodKey === "custom" ? "on" : ""}`}
            onClick={() => pick("custom")}>
            Custom range
            {periodKey === "custom" && <span className="tick"><Icon name="check" size={14} /></span>}
          </button>

          {custom && (
            <div className="periodcustom">
              <div className="dates">
                <div>
                  <span className="lbl">From</span>
                  <input type="date" value={draftFrom} max={draftTo || undefined}
                    aria-label="From date" onChange={(e) => setDraftFrom(e.target.value)} />
                </div>
                <div>
                  <span className="lbl">To</span>
                  <input type="date" value={draftTo} min={draftFrom || undefined}
                    aria-label="To date" onChange={(e) => setDraftTo(e.target.value)} />
                </div>
              </div>
              {invalid && <p className="err" style={{ marginTop: 6 }}>The start date is after the end date.</p>}
              <div className="acts">
                <Button size="sm" onClick={applyCustom} disabled={invalid || (!draftFrom && !draftTo)}>
                  Apply
                </Button>
                <Button variant="secondary" size="sm"
                  onClick={() => { setDraftFrom(""); setDraftTo(""); setCustom(false); pick("all"); }}>
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
