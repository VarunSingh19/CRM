"use client";
import { calcLine, money, num } from "@/lib/money";
import { STATUSES, hasTopic, secShort, secKey, TBD } from "@/lib/defaults";
import Icon from "@/components/ui/Icon";
import { Badge, Button, Field, statusTone } from "@/components/ui/primitives";
import type { Item, Offering, Role } from "./types";

interface Props {
  item: Item;
  index: number;
  offerings: Offering[];
  offering: Offering | null;
  role: Role;
  /** Commercials are off for a barter project that has not opted in. */
  showMoney: boolean;
  open: boolean;
  dirty: boolean;
  selected: boolean;
  focused?: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onPatch: (key: keyof Item, value: unknown) => void;
  onOfferingChange: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPropose: () => void;
}

export default function ItemCard(p: Props) {
  const { item: it, offering: o, role, showMoney } = p;
  /**
   * Ops adds and edits content alongside sales. Removing an item is the one
   * thing it cannot do — that needs delete on lineItem, which the role does not
   * hold, so the button would only draw a refusal from the server.
   */
  const canRemove = role !== "ops";
  /** The agreed scope is what was sold, so it stays sales-only to change. */
  const lockScope = role === "ops";
  const k = secKey(it.section);
  const c = calcLine({
    qty: it.qty, rate: it.rate, discType: it.discType,
    discValue: it.discValue, amountOverride: it.amountOverride,
  });
  const names = p.offerings.map((x) => x.name);

  const choice = (label: string, key: keyof Item, list: string[], disabled = false) =>
    list.length ? (
      <Field key={String(key)} label={label}>
        <select value={(it[key] as string) ?? ""} disabled={disabled}
          onChange={(e) => p.onPatch(key, e.target.value)}>
          {list.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
    ) : (
      <Field key={String(key)} label={label}>
        <input value="Not applicable" disabled />
      </Field>
    );

  const bodyId = `item-body-${it._id}`;
  const title = it.topic || it.projDesc || it.name;

  /* The summary line, identical either way — only what wraps it changes. */
  const summary = (
    <>
      <span className="seq">{p.index + 1}</span>
      <Badge tone="neutral">{secShort(it.section)}</Badge>
      <Badge tone={statusTone(it.status)} dot>{it.status}</Badge>
      <span className="item-title">{title}</span>
      {showMoney && <span className="item-amt num">{money(c.net)}</span>}
      {p.dirty && <Badge tone="warn">unsaved</Badge>}
    </>
  );

  return (
    <div className={`item ${k}${p.focused ? " focused" : ""}`} id={`item-${it._id}`}>
      {/* The checkbox sits outside the trigger in both states: selecting a card
          and opening it are different intentions, and interactive content
          cannot be nested inside a button anyway. */}
      <div className={`item-head${p.open ? " open" : ""}`}>
        <input type="checkbox" className="pick" checked={p.selected} onChange={p.onSelect}
          aria-label={`Select ${title}`} />

        {p.open ? (
          /* Open: the row is inert. Someone reading or editing a long card must
             not lose it by clicking a blank part of the header, so collapsing
             is deliberate — the button, and only the button. */
          <>
            {summary}
            <Button variant="ghost" size="sm" onClick={p.onToggle}
              icon="collapse" aria-label={`Collapse ${title}`}
              aria-expanded aria-controls={bodyId} />
          </>
        ) : (
          /* Closed: the whole row opens it, which is a large, forgiving target
             on a phone and costs nothing to undo. */
          <button type="button" className="item-open" onClick={p.onToggle}
            aria-expanded={false} aria-controls={bodyId}>
            {summary}
            <span className="item-chev"><Icon name="expand" size={15} /></span>
          </button>
        )}
      </div>

      {p.open && (
        <div className="item-body" id={bodyId}>
          <div className="grid k2">
            {hasTopic(it.section) ? (
              <Field label="Topic name" hint={`Left blank, documents print “${TBD}”.`}>
                <input value={it.topic ?? ""} placeholder={TBD}
                  onChange={(e) => p.onPatch("topic", e.target.value)} />
              </Field>
            ) : (
              <Field label="Project description">
                <input value={it.projDesc ?? ""} placeholder="What this media service covers"
                  onChange={(e) => p.onPatch("projDesc", e.target.value)} />
              </Field>
            )}
            <Field label="Status">
              <select value={it.status} onChange={(e) => p.onPatch("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid k2" style={{ marginTop: 12 }}>
            <Field label="Content category">
              <select value={it.name}
                onChange={(e) => p.onOfferingChange(e.target.value)}>
                {names.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            {choice("Card type", "cardType", o?.cardTypes ?? [])}
          </div>

          <div className="grid k3" style={{ marginTop: 12 }}>
            {choice("Promotion type", "promo", o?.promo ?? [])}
            {choice("Streamed as", "stream", o?.stream ?? [])}
            {choice("Produced by", "produced", o?.produced ?? [])}
          </div>

          <div className="section-label">Scope</div>
          <div className="stack">
            <Field label="Inclusions">
              <textarea rows={3} value={it.incl ?? ""} disabled={lockScope}
                onChange={(e) => p.onPatch("incl", e.target.value)} />
            </Field>
            <Field label="Exclusions">
              <textarea rows={3} value={it.excl ?? ""} disabled={lockScope}
                onChange={(e) => p.onPatch("excl", e.target.value)} />
            </Field>
            <Field label="Deviations, if any">
              <textarea rows={2} value={it.dev ?? ""}
                placeholder="Anything agreed outside the standard scope"
                onChange={(e) => p.onPatch("dev", e.target.value)} />
            </Field>
          </div>

          {showMoney && (
            <>
              <div className="section-label">Commercials</div>
              <div className="grid k4">
                <Field label="Quantity">
                  <input type="number" min={0} step={1} value={it.qty}
                    onChange={(e) => p.onPatch("qty", num(e.target.value))} />
                </Field>
                <Field label="Rate (₹)">
                  <input type="number" min={0} step={0.01} value={it.rate}
                    onChange={(e) => p.onPatch("rate", num(e.target.value))} />
                </Field>
                <Field label="Duration">
                  <input value={it.duration ?? ""} onChange={(e) => p.onPatch("duration", e.target.value)} />
                </Field>
                <Field label="Amount (₹)" hint="Leave blank for qty × rate">
                  <input type="number" min={0} step={0.01}
                    value={it.amountOverride === "" || it.amountOverride == null ? "" : it.amountOverride}
                    placeholder={(num(it.qty) * num(it.rate)).toFixed(2)}
                    onChange={(e) => p.onPatch("amountOverride", e.target.value === "" ? "" : num(e.target.value))} />
                </Field>
              </div>
              <div className="grid k2" style={{ marginTop: 12 }}>
                <Field label="Line discount">
                  <div className="split">
                    <select value={it.discType} onChange={(e) => p.onPatch("discType", e.target.value)}>
                      <option value="amount">₹</option>
                      <option value="percent">%</option>
                    </select>
                    <input type="number" min={0} step={0.01} value={it.discValue}
                      onChange={(e) => p.onPatch("discValue", num(e.target.value))} />
                  </div>
                </Field>
                <Field label="Line net (before tax)">
                  <input value={money(c.net)} disabled />
                </Field>
              </div>
            </>
          )}

          <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
            {showMoney && <Button variant="secondary" size="sm" onClick={p.onPropose}>Propose to a partner</Button>}
            <Button variant="secondary" size="sm" icon="copy" onClick={p.onDuplicate}>Duplicate</Button>
            {canRemove && <Button variant="ghost" size="sm" icon="trash" onClick={p.onDelete}>Remove</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
