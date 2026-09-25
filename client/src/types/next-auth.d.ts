import type { DefaultSession } from "next-auth";

type AppRole = "admin" | "sales" | "ops";

declare module "next-auth" {
  interface User {
    role?: AppRole;
    username?: string;
  }
  interface Session {
    user: {
      id: string;
      role: AppRole;
      username: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    username?: string;
  }
}
