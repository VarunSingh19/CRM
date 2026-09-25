import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { updatePartner, deletePartner } from "@/features/partners/partner.service";

export const PATCH = withUser(async ({ user, req, params }) =>
  NextResponse.json(await updatePartner(user, params.id, await readJson(req))));
export const DELETE = withUser(async ({ user, params }) =>
  NextResponse.json(await deletePartner(user, params.id)));
