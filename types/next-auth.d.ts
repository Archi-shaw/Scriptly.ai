import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
    /** Session version; must match the user's current `sessionVersion`. */
    sv: number;
  }

  interface User {
    id: string;
    sv?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    sv?: number;
  }
}
