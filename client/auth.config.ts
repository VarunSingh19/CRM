import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe config (no Mongoose here). Middleware imports this.
 * The Credentials provider with the DB lookup lives in auth.ts (Node runtime).
 */
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [], // real provider added in auth.ts
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.username = (user as { username?: string }).username;
        token.name = user.name ?? token.name;
      }
      // Saving the profile page calls useSession().update({ name }). Without
      // this the name lives in the token until the next sign-in, so the top bar
      // would keep showing the old one after a rename.
      if (trigger === "update" && (session as { name?: string })?.name) {
        token.name = (session as { name?: string }).name as string;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as "admin" | "sales" | "ops";
        session.user.username = token.username as string;
      }
      return session;
    },
  },
};
