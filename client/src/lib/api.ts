import { NextResponse } from "next/server";
import { getUser, type CurrentUser } from "./session";
import { writeAuthAudit } from "@/features/audit/audit.service";

type Ctx = { params: Promise<Record<string, string>> };

/** Wrap a route handler: injects current user + request, maps errors to JSON. */
export function withUser(
  handler: (args: {
    user: CurrentUser;
    req: Request;
    params: Record<string, string>;
  }) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const user = await getUser();
      if (!user)
        return NextResponse.json(
          { error: "Not authenticated" },
          { status: 401 },
        );
      const params = ctx?.params ? await ctx.params : {};
      return await handler({ user, req, params });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 400;
      const message = err instanceof Error ? err.message : "Request failed";
      // A 403 means someone reached past what their role allows. The UI hides
      // those controls, so this only fires on a direct call — worth recording.
      if (status === 403) {
        const who = await getUser();
        await writeAuthAudit("auth.denied", {
          actorId: who?.id,
          actorName: who?.name ?? "",
          actorRole: who?.role ?? "",
          label: `Denied: ${new URL(req.url).pathname} — ${message}`,
          meta: {
            method: req.method,
            path: new URL(req.url).pathname,
            message,
          },
        });
      }
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
