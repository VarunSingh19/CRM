"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import Icon from "@/components/ui/Icon";
import type { PartnerRow } from "./types";

/**
 * Searchable partner lookup. A plain <select> is unusable once the list runs to
 * dozens of names, so this filters as you type and shows the type and email to
 * disambiguate similarly-named accounts.
 */
export default function PartnerPicker({
  partners, onPick, onCreateNew, label = "Partner",
}: {
  partners: PartnerRow[];
  onPick: (p: PartnerRow) => void;
  onCreateNew: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return partners;
    return partners.filter((p) =>
      [p.name, p.email, p.contact, p.gstin].some((v) => (v ?? "").toLowerCase().includes(term)));
  }, [partners, q]);

  useEffect(() => { setCursor(0); }, [q]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(p: PartnerRow) {
    onPick(p);
    setOpen(false);
    setQ("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, matches.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && matches[cursor]) { e.preventDefault(); choose(matches[cursor]); }
  }

  return (
    <div className="combo" ref={wrap}>
      <Button variant="secondary" icon="partners" onClick={() => setOpen((o) => !o)}>
        {label}
        <Icon name="chevronDown" size={14} />
      </Button>

      {open && (
        <div className="combomenu" onKeyDown={onKeyDown}>
          <div className="search">
            <input
              ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email or GSTIN" aria-label="Search partners"
            />
          </div>
          <div className="list">
            <button type="button" className="row create" onClick={() => { setOpen(false); onCreateNew(); }}>
              <Icon name="plus" size={14} /> Create a new partner
              <span className="sub">Enter details from scratch</span>
            </button>
            <div className="sep" />
            {matches.map((p, i) => (
              <button key={p._id} type="button"
                className={`row ${i === cursor ? "on" : ""}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => choose(p)}>
                {p.name}
                <span className="sub">
                  {[p.type, p.email].filter(Boolean).join(" · ") || "No contact details"}
                </span>
              </button>
            ))}
            {matches.length === 0 && (
              <div className="none">
                {partners.length ? `No partner matches “${q.trim()}”.` : "No partners saved yet."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
