import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { listLineItems, createLineItem } from "@/features/line-items/line-item.service";

export const GET = withUser(async ({ user, req }) => {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  return NextResponse.json(await listLineItems(user, projectId));
});
export const POST = withUser(async ({ user, req }) => {
  const body = await readJson(req);
  const projectId = String(body.projectId ?? "");
  delete body.projectId;
  return NextResponse.json(await createLineItem(user, projectId, body), { status: 201 });
});
