import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { search } from "@/features/search/search.service";

export const GET = withUser(async ({ user, req }) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json(await search(user, q));
});
