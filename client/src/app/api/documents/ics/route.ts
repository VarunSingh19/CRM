import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { generateICS } from "@/features/documents/documents.service";

export const GET = withUser(async ({ user, req }) => {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  const { ics, filename } = await generateICS(user, projectId);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
