"use client";
import { money, num, toWords, totals as computeTotals, GST_RATE } from "@/lib/money";
import { Field } from "@/components/ui/primitives";
import type { Item } from "./types";

interface Props {
  items: Item[];
  gstMode: "intra" | "inter";
  docDiscType: "amount" | "percent";
  docDiscValue: number;
  disabled: boolean;
  onDocDisc: (type: "amount" | "percent", value: number) => void;
}

/** Running commercial summary, recalculated as you type. */
export default function Ledger(p: Props) {
  const t = computeTotals({
    items: p.items.map((i) => ({
      qty: i.qty, rate: i.rate, discType: i.discType,
      discValue: i.discValue, amountOverride: i.amountOverride,
    })),
    docDiscType: p.docDiscType,
    docDiscValue: p.docDiscValue,
    gstMode: p.gstMode,
  });
  const half = GST_RATE / 2;

  return (
    <div className="ledger">
      <div className="lrow sub"><span>Line items</span><span className="v">{p.items.length}</span></div>
      <div className="lrow"><span>Gross amount</span><span className="v">{money(t.gross)}</span></div>
      <div className="lrow sub"><span>Less: line discounts</span><span className="v">{money(t.lineDisc)}</span></div>
      <div className="lrow mid"><span>Sub-total</span><span className="v">{money(t.sub)}</span></div>

      <div style={{ margin: "10px 0 6px" }}>
        <Field label="Discount on sub-total">
          <div className="split">
            <select value={p.docDiscType} disabled={p.disabled}
              onChange={(e) => p.onDocDisc(e.target.value as "amount" | "percent", p.docDiscValue)}>
              <option value="amount">₹</option>
              <option value="percent">%</option>
            </select>
            <input type="number" min={0} step={0.01} value={p.docDiscValue} disabled={p.disabled}
              onChange={(e) => p.onDocDisc(p.docDiscType, num(e.target.value))} />
          </div>
        </Field>
      </div>

      <div className="lrow sub"><span>Less: discount</span><span className="v">{money(t.docDisc)}</span></div>
      <div className="lrow mid"><span>Taxable value</span><span className="v">{money(t.taxable)}</span></div>

      {p.gstMode === "inter" ? (
        <div className="lrow sub"><span>IGST {GST_RATE}%</span><span className="v">{money(t.igst)}</span></div>
      ) : (
        <>
          <div className="lrow sub"><span>CGST {half}%</span><span className="v">{money(t.cgst)}</span></div>
          <div className="lrow sub"><span>SGST {half}%</span><span className="v">{money(t.sgst)}</span></div>
        </>
      )}

      <div className="lrow total"><span>Grand total</span><span>{money(t.total)}</span></div>
      <div className="words">{p.items.length ? toWords(t.total) : "—"}</div>
    </div>
  );
}
