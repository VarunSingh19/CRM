import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { getSettings, updateSettings } from "@/features/settings/settings.service";

export const GET = withUser(async () => NextResponse.json(await getSettings()));
export const PATCH = withUser(async ({ user, req }) =>
  NextResponse.json(await updateSettings(user, await readJson(req))));
