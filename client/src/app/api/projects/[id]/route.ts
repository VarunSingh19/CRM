import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { getProject, updateProject, deleteProject } from "@/features/projects/project.service";

export const GET = withUser(async ({ user, params }) => {
  const data = await getProject(user, params.id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
});
export const PATCH = withUser(async ({ user, req, params }) =>
  NextResponse.json(await updateProject(user, params.id, await readJson(req))));
export const DELETE = withUser(async ({ user, params }) =>
  NextResponse.json(await deleteProject(user, params.id)));
