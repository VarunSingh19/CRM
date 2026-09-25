import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getDashboard } from "@/features/dashboard/dashboard.service";
import { resolvePeriod } from "@/lib/period";

export const GET = withUser(async ({ user, req }) => {
  const q = new URL(req.url).searchParams;
  const period = resolvePeriod(
    q.get("period") ?? undefined,
    q.get("from") ?? undefined,
    q.get("to") ?? undefined,
  );
  return NextResponse.json(await getDashboard(user, period));
});
