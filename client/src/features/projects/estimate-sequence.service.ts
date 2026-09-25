import { connectDB } from "@/lib/db";
import { EstimateSequence } from "./estimate-sequence.model";
import { fyOf } from "@/lib/defaults";

/** Mint the next estimate number for the financial year of `dateStr`.
 *  Format matches the legacy tool exactly: ONF/EST/2026-27/0001 */
export async function nextEstimateNo(dateStr?: string): Promise<string> {
  await connectDB();
  const fy = fyOf(dateStr);
  const row = (await EstimateSequence.findOneAndUpdate(
    { key: fy },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean()) as unknown as { seq: number } | null;
  const seq = row?.seq ?? 1;
  return `ONF/EST/${fy}/${String(seq).padStart(4, "0")}`;
}
