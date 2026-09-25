import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { listPartners, createPartner } from "@/features/partners/partner.service";

export const GET = withUser(async ({ user }) => NextResponse.json(await listPartners(user)));
export const POST = withUser(async ({ user, req }) =>
  NextResponse.json(await createPartner(user, await readJson(req)), { status: 201 }));
