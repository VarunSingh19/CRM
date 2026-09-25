import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { connectDB } from "@/lib/db";
import { User } from "@/features/users/user.model";
import { writeAuthAudit } from "@/features/audit/audit.service";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    async signOut(message) {
      const token = (message as { token?: { sub?: string; name?: string; role?: string } }).token;
      if (!token?.sub) return;
      await writeAuthAudit("auth.logout", {
        actorId: token.sub,
        actorName: token.name ?? "",
        actorRole: token.role ?? "",
        label: "Signed out",
      });
    },
  },
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(creds) {
        // the field is still named "username"; it now accepts either credential
        const identifier = String(creds?.username ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!identifier || !password) return null;

        await connectDB();

        // Only treat it as an email when it looks like one. Without that guard a
        // plain username could match the empty-string email that accounts
        // without one carry, and sign in as whichever came back first.
        const or: Record<string, string>[] = [{ username: identifier }];
        if (identifier.includes("@")) or.push({ email: identifier });

        const user = await User.findOne({ active: true, $or: or })
          .select("+passwordHash")
          .lean<{ _id: unknown; name: string; username: string; email?: string; role: string; passwordHash: string } | null>();

        // A failed attempt is the only signal that a password has leaked, so it
        // is logged even when there is no account to attribute it to. The
        // reason is recorded but never shown at the login screen, which must
        // not reveal whether a username exists.
        if (!user) {
          await writeAuthAudit("auth.login.failed", {
            actorName: identifier,
            label: `Failed sign-in for “${identifier}” — no active account`,
            meta: { identifier, reason: "unknown-or-inactive" },
          });
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await writeAuthAudit("auth.login.failed", {
            actorId: String(user._id),
            actorName: user.name,
            actorRole: user.role,
            label: `Failed sign-in for “${identifier}” — wrong password`,
            meta: { identifier, reason: "bad-password" },
          });
          return null;
        }

        await writeAuthAudit("auth.login", {
          actorId: String(user._id),
          actorName: user.name,
          actorRole: user.role,
          label: "Signed in",
          meta: { username: user.username, via: identifier === user.username ? "username" : "email" },
        });

        return {
          id: String(user._id),
          name: user.name,
          username: user.username,
          email: user.email ?? "",
          role: user.role as "admin" | "sales" | "ops",
        };
      },
    }),
  ],
});
