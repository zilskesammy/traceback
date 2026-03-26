// types/next-auth.d.ts — Session-Typ um Traceback-Felder erweitern

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      githubId: string | null;
      githubLogin: string | null;
    } & DefaultSession["user"];
  }
}
