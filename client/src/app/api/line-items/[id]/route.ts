import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { updateLineItem, deleteLineItem } from "@/features/line-items/line-item.service";

export const PATCH = withUser(async ({ user, req, params }) =>
  NextResponse.json(await updateLineItem(user, params.id, await readJson(req))));
export const DELETE = withUser(async ({ user, params }) =>
  NextResponse.json(await deleteLineItem(user, params.id)));
