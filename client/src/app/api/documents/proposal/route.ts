import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { generateProposal, type ProposalInput } from "@/features/documents/documents.service";

/** Single-card estimate — the legacy "Propose" flow. */
export const POST = withUser(async ({ user, req }) => {
  const b = await readJson(req);
  const mode = b.mode === "word" ? "word" : "preview";
  const proposal = {
    lineItemId: String(b.lineItemId ?? ""),
    gstMode: b.gstMode === "inter" ? "inter" : "intra",
    partner: (b.partner ?? {}) as ProposalInput["partner"],
    override: (b.override ?? {}) as ProposalInput["override"],
  } satisfies ProposalInput;

  const { html, filename } = await generateProposal(user, String(b.projectId ?? ""), proposal, mode);

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
