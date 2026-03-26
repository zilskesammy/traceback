// lib/auth.ts — NextAuth v5 Konfiguration mit GitHub Provider + Prisma Adapter

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(db),

  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
    }),
  ],

  session: {
    strategy: "database",
  },

  callbacks: {
    // GitHub Login/ID in User-Row speichern
    async signIn({ user, account, profile }) {
      if (account?.provider === "github" && profile) {
        const githubProfile = profile as {
          id?: number;
          login?: string;
        };

        if (githubProfile.id && user.id) {
          await db.user.update({
            where: { id: user.id },
            data: {
              githubId: String(githubProfile.id),
              githubLogin: githubProfile.login ?? null,
            },
          });
        }
      }
      return true;
    },

    // Session um userId + githubLogin erweitern
    async session({ session, user }) {
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          githubId: true,
          githubLogin: true,
        },
      });

      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          githubId: dbUser?.githubId ?? null,
          githubLogin: dbUser?.githubLogin ?? null,
        },
      };
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
