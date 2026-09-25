import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { generateDocument, type DocType } from "@/features/documents/documents.service";

/**
 * mode "preview" -> text/html for the in-app iframe (Propose buttons active)
 * mode "word"    -> application/msword attachment (default)
 */
export const POST = withUser(async ({ user, req }) => {
  const b = await readJson(req);
  const mode = b.mode === "preview" ? "preview" : "word";
  const { html, filename } = await generateDocument(user, String(b.projectId ?? ""), b.type as DocType, {
    mode,
    calView: b.calView === "calendar" ? "calendar" : "kanban",
    calMonth: b.calMonth ? String(b.calMonth) : undefined,
  });

  if (mode === "preview") {
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return new NextResponse("\ufeff" + html, {
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
