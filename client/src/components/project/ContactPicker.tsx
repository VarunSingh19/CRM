"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { normName, sameHuman, type ContactIntent } from "@/features/contacts/contact.match";
import type { ContactRow } from "./types";

/**
 * The Contact Person field, backed by the contact directory.
 *
 * Typing filters every contact on record and lists this partner's own people
 * first — the present one, then whoever held the seat before — so the history
 * is visible at the point where it matters. Everyone else follows, labelled
 * with the partner they are at now, which is how a contact who changed
 * companies is found again without retyping their email and mobile.
 *
 * When the name changes, the component asks whether that is a correction to the
 * person on record or a genuine handover, because guessing from the name alone
 * files a fixed typo or a new job title as a second person.
 */
export default function ContactPicker({
  id, value, email, mobile, contacts, partnerId, partnerName,
  disabled, invalid, intent, onIntentChange, onPick, onChange, onRemove,
}: {
  id: string;
  value: string;
  email: string;
  mobile: string;
  contacts: ContactRow[];
  /** The partner this project is linked to; blank when none is linked yet. */
  partnerId: string;
  partnerName: string;
  disabled?: boolean;
  invalid?: boolean;
  intent: ContactIntent | null;
  onIntentChange: (i: ContactIntent | null) => void;
  onPick: (c: { name: string; email: string; mobile: string }) => void;
  onChange: (name: string) => void;
  /** Deletes a row filed by mistake. Omitted where the user cannot edit partners. */
  onRemove?: (c: ContactRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  const { here, others } = useMemo(() => {
    const term = value.trim().toLowerCase();
    const match = (c: ContactRow) =>
      !term || [c.name, c.email, c.mobile, c.partnerName].some((v) => (v ?? "").toLowerCase().includes(term));

    const mine: ContactRow[] = [];
    const rest: ContactRow[] = [];
    for (const c of contacts) {
      if (!match(c)) continue;
      (partnerId && c.partnerId === partnerId ? mine : rest).push(c);
    }
    // current contact at the top, previous ones under it in name order
    mine.sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name));
    rest.sort((a, b) => a.partnerName.localeCompare(b.partnerName) || a.name.localeCompare(b.name));
    return { here: mine, others: rest };
  }, [contacts, partnerId, value]);

  const ordered = useMemo(() => [...here, ...others], [here, others]);

  /** Who the directory says holds the seat right now — filter-independent. */
  const seated = useMemo(
    () => contacts.find((c) => c.partnerId === partnerId && c.current) ?? null,
    [contacts, partnerId]
  );

  const typed = value.trim();
  const isNew = !!typed && !ordered.some((c) => normName(c.name) === normName(typed));

  /**
   * The name moved away from whoever is on record, so it is either a correction
   * or a handover and the two cannot be told apart from the text alone.
   */
  const ambiguous = !!seated && !!typed && normName(typed) !== normName(seated.name);

  // an inline arrow prop would change identity every render, so the effect
  // below reads the callback from a ref instead of depending on it
  const notify = useRef(onIntentChange);
  notify.current = onIntentChange;

  /**
   * Proposes an answer whenever the name or the partner changes: an edit that
   * still reads as the same human defaults to a correction, an unrelated name
   * to a handover. Clicking either option overrides this until the name is
   * edited again.
   */
  useEffect(() => {
    if (!typed || !seated) { notify.current(null); return; }
    if (normName(typed) === normName(seated.name)) {
      notify.current({ mode: "update", contactId: seated._id });
      return;
    }
    notify.current(
      sameHuman(typed, seated.name)
        ? { mode: "update", contactId: seated._id }
        : { mode: "new" }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, seated?._id, partnerId]);

  useEffect(() => { setCursor(0); }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(c: ContactRow) {
    // A blank email or mobile on the record must not wipe a number that is the
    // company's rather than the person's, so only real values are copied over.
    onPick({ name: c.name, email: c.email || email, mobile: c.mobile || mobile });
    // Picking is unambiguous: one of this partner's own rows is that row being
    // brought back, anyone else is a new arrival here.
    onIntentChange(c.partnerId === partnerId ? { mode: "update", contactId: c._id } : { mode: "new" });
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, ordered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && open && ordered[cursor]) { e.preventDefault(); choose(ordered[cursor]); }
  }

  const row = (c: ContactRow, i: number, mine: boolean) => (
    <div key={c._id} className={`rowwrap ${i === cursor ? "on" : ""}`} onMouseEnter={() => setCursor(i)}>
      <button type="button" className="row" id={`${id}-opt-${i}`} role="option"
        aria-selected={i === cursor} onClick={() => choose(c)}>
        <span className="nm">
          {c.name}
          {mine && (
            <span className={`tag ${c.current ? "now" : ""}`}>{c.current ? "Current" : "Previous"}</span>
          )}
        </span>
        <span className="sub">
          {[mine ? "" : c.partnerName, c.email, c.mobile].filter(Boolean).join(" · ") || "No details on record"}
        </span>
      </button>
      {onRemove && mine && !c.current && (
        <button
          type="button"
          className="drop"
          title={`Remove ${c.name} from the directory`}
          aria-label={`Remove ${c.name} from the directory`}
          onClick={(e) => { e.stopPropagation(); onRemove(c); }}
        >
          <Icon name="trash" size={13} />
        </button>
      )}
    </div>
  );

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
          placeholder="Type a name, or search past contacts"
          onFocus={() => setOpen(true)}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        {!disabled && (
          <button
            type="button"
            className="cpicktoggle"
            aria-label="Browse contacts"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name="history" size={15} />
          </button>
        )}

        {open && !disabled && (
          <div className="cpickmenu">
            <div className="list" id={`${id}-listbox`} role="listbox" aria-label="Contacts">
              {here.length > 0 && (
                <div className="head">At {partnerName || "this partner"}</div>
              )}
              {here.map((c, i) => row(c, i, true))}

              {others.length > 0 && (
                <div className="head">{here.length ? "Contacts at other partners" : "All contacts"}</div>
              )}
              {others.map((c, i) => row(c, here.length + i, false))}

              {ordered.length === 0 && (
                <div className="none">
                  {contacts.length
                    ? `Nobody on record matches “${typed}”.`
                    : "No contacts on record yet. Type a name and save the partner to start the history."}
                </div>
              )}
            </div>

            {isNew && !ambiguous && (
              <div className="foot">
                <Icon name="plus" size={13} />
                <span>“{typed}” is new — saving the partner adds them.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* The one question the name alone cannot answer. */}
      {ambiguous && !disabled && (
        <div className="cpickintent">
          <div className="q">
            This is not {seated!.name}. Which is it?
          </div>
          <label className={intent?.mode !== "new" ? "on" : ""}>
            <input
              type="radio"
              name={`${id}-intent`}
              checked={intent?.mode !== "new"}
              onChange={() => onIntentChange({ mode: "update", contactId: seated!._id })}
            />
            <span>
              <b>Same person</b> — correct their name on record. No second entry.
            </span>
          </label>
          <label className={intent?.mode === "new" ? "on" : ""}>
            <input
              type="radio"
              name={`${id}-intent`}
              checked={intent?.mode === "new"}
              onChange={() => onIntentChange({ mode: "new" })}
            />
            <span>
              <b>Someone new</b> — keep {seated!.name} on record as the previous contact.
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
