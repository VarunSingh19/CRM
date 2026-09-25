import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { listOfferings, createOffering } from "@/features/catalog/catalog.service";

export const GET = withUser(async ({ user }) => NextResponse.json(await listOfferings(user)));
export const POST = withUser(async ({ user, req }) =>
  NextResponse.json(await createOffering(user, await readJson(req)), { status: 201 }));
