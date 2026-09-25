import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { listProjects, createProject } from "@/features/projects/project.service";

export const GET = withUser(async ({ user }) => NextResponse.json(await listProjects(user)));
export const POST = withUser(async ({ user, req }) =>
  NextResponse.json(await createProject(user, await readJson(req)), { status: 201 }));
