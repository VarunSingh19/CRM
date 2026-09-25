import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { updateOffering, deleteOffering } from "@/features/catalog/catalog.service";

export const PATCH = withUser(async ({ user, req, params }) =>
  NextResponse.json(await updateOffering(user, params.id, await readJson(req))));
export const DELETE = withUser(async ({ user, params }) =>
  NextResponse.json(await deleteOffering(user, params.id)));
