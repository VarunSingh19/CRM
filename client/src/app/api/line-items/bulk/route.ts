import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { bulkUpdateLineItems, bulkDeleteLineItems } from "@/features/line-items/line-item.service";

const idsOf = (b: Record<string, unknown>): string[] =>
  Array.isArray(b.ids) ? b.ids.map(String).filter(Boolean) : [];

/** PATCH = bulk field change, POST with {op:"delete"} = bulk delete. */
export const PATCH = withUser(async ({ user, req }) => {
  const b = await readJson(req);
  const patch = (b.patch ?? {}) as Record<string, unknown>;
  return NextResponse.json(await bulkUpdateLineItems(user, idsOf(b), patch));
});

export const POST = withUser(async ({ user, req }) => {
  const b = await readJson(req);
  if (b.op !== "delete") return NextResponse.json({ error: "Unsupported operation" }, { status: 400 });
  return NextResponse.json(await bulkDeleteLineItems(user, idsOf(b)));
});
