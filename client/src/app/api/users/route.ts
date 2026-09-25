import { NextResponse } from "next/server";
import { withUser, readJson } from "@/lib/api";
import { listUsers, createUser } from "@/features/users/user.service";

export const GET = withUser(async ({ user }) =>
  NextResponse.json(await listUsers(user)),
);
export const POST = withUser(async ({ user, req }) => {
  const b = await readJson(req);
  return NextResponse.json(
    await createUser(user, {
      username: String(b.username ?? ""),
      name: String(b.name ?? ""),
      email: String(b.email ?? ""),
      role: b.role as "admin" | "sales" | "ops",
      password: String(b.password ?? ""),
    }),
    { status: 201 },
  );
});
