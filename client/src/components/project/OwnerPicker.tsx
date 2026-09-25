"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { normName } from "@/features/contacts/contact.match";
import type { Role, StaffRow } from "./types";

/** Which role usually holds this seat, so it sorts to the top of the list. */
const PREFERRED: Record<"account" | "production", Role> = {
  account: "sales",
  production: "ops",
};

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  sales: "Sales",
  ops: "Production",
};

/**
 * The Account owner and Production owner fields, backed by the staff roster.
 *
 * Unlike the contact picker this asks no questions on save. A partner contact
 * changing name is ambiguous — a correction or a handover, and the text alone
 * cannot say which. An owner is picked off a fixed roster of colleagues, so
 * reassigning is simply reassigning and there is nothing to disambiguate.
 *
 * The field stays free text underneath. Owners are printed on the kick-off
 * document straight from the project, and the work is sometimes held by a
 * freelancer who has no login here, so a typed name that matches nobody is
 * kept rather than rejected.
 */
export default function OwnerPicker({
  id, value, staff, seat, disabled, invalid, onChange,
}: {
  id: string;
  value: string;
  staff: StaffRow[];
  /** Which of the two seats this is; decides whose role floats to the top. */
  seat: "account" | "production";
  disabled?: boolean;
  invalid?: boolean;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  const preferred = PREFERRED[seat];

  const { here, others } = useMemo(() => {
    const term = value.trim().toLowerCase();
    const match = (s: StaffRow) => !term || s.name.toLowerCase().includes(term);

    const mine: StaffRow[] = [];
    const rest: StaffRow[] = [];
    for (const s of staff) {
      if (!match(s)) continue;
      (s.role === preferred ? mine : rest).push(s);
    }
    // the roster already arrives name-sorted; only the split matters here
    return { here: mine, others: rest };
  }, [staff, preferred, value]);

  const ordered = useMemo(() => [...here, ...others], [here, others]);

  const typed = value.trim();
  const isNew = !!typed && !ordered.some((s) => normName(s.name) === normName(typed));

  useEffect(() => { setCursor(0); }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(s: StaffRow) {
    onChange(s.name);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, ordered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && open && ordered[cursor]) { e.preventDefault(); choose(ordered[cursor]); }
  }

  const row = (s: StaffRow, i: number, mine: boolean) => (
    <div key={s._id} className={`rowwrap ${i === cursor ? "on" : ""}`} onMouseEnter={() => setCursor(i)}>
      <button type="button" className="row" id={`${id}-opt-${i}`} role="option"
        aria-selected={i === cursor} onClick={() => choose(s)}>
        <span className="nm">
          {s.name}
          {normName(s.name) === normName(typed) && <span className="tag now">Assigned</span>}
        </span>
        <span className="sub">{mine ? "" : ROLE_LABEL[s.role]}</span>
      </button>
    </div>
  );

  const seatLabel = seat === "account" ? "Sales" : "Production";

  return (
    <div className="cpick" ref={wrap}>
      <div className="cpickbox">
        <input
          id={id}
          value={value}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          aria-activedescendant={open && ordered[cursor] ? `${id}-opt-${cursor}` : undefined}
          aria-invalid={invalid || undefined}
          className={invalid ? "bad" : ""}
          placeholder="Type a name, or pick from the team"
          onFocus={() => setOpen(true)}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        {!disabled && (
          <button
            type="button"
            className="cpicktoggle"
            aria-label="Browse the team"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name="history" size={15} />
          </button>
        )}

        {open && !disabled && (
          <div className="cpickmenu">
            <div className="list" id={`${id}-listbox`} role="listbox" aria-label="Team members">
              {here.length > 0 && <div className="head">{seatLabel}</div>}
              {here.map((s, i) => row(s, i, true))}

              {others.length > 0 && (
                <div className="head">{here.length ? "Everyone else" : "The team"}</div>
              )}
              {others.map((s, i) => row(s, here.length + i, false))}

              {ordered.length === 0 && (
                <div className="none">
                  {staff.length
                    ? `Nobody on the team matches “${typed}”.`
                    : "No team members on record yet."}
                </div>
              )}
            </div>

            {isNew && (
              <div className="foot">
                <Icon name="plus" size={13} />
                <span>“{typed}” is not on the team — it will be saved as typed.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
