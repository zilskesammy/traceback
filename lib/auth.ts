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
    // GitHub Login/ID in User-Row speichern — non-blocking, nie AccessDenied werfen
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === "github" && profile && user.id) {
          const githubProfile = profile as {
            id?: number;
            login?: string;
          };
          if (githubProfile.id) {
            await db.user.update({
              where: { id: user.id },
              data: {
                githubId: String(githubProfile.id),
                githubLogin: githubProfile.login ?? null,
              },
            });
          }
        }
      } catch {
        // Fehler hier soll Login nicht blockieren
      }
      return true;
    },

    // Session um userId + githubLogin erweitern
    async session({ session, user }) {
      try {
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { id: true, githubId: true, githubLogin: true },
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
      } catch {
        return { ...session, user: { ...session.user, id: user.id } };
      }
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
