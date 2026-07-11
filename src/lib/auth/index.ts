/**
 * NextAuth Configuration (v4)
 *
 * Main authentication configuration with JWT sessions, Prisma adapter,
 * and session enrichment with the user role.
 */

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { UserRole } from "@prisma/client";
import NextAuth from "next-auth";
import { getServerSession as nextAuthGetServerSession } from "next-auth";
import type { NextAuthOptions } from "next-auth";

import { prisma } from "@/lib/db/prisma";
import { SESSION_CONFIG } from "./constants";
import { getProviders } from "./providers";
import "./types"; // Import type augmentations

/**
 * Admin emails that get ADMIN role on first sign-in
 * Comma-separated list from environment variable
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAIL ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

/**
 * NextAuth configuration options
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: getProviders(),
  session: {
    strategy: "jwt",
    maxAge: SESSION_CONFIG.maxAge,
    updateAge: SESSION_CONFIG.updateAge,
  },
  pages: {
    signIn: "/signin",
    signOut: "/signout",
    error: "/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    /**
     * Handle sign-in: Log events
     */
    async signIn({ user, account }) {
      if (!user.email) {
        return false;
      }

      // Log sign-in event
      try {
        await prisma.auditLog.create({
          data: {
            action: "USER_LOGIN",
            resource: "auth",
            details: JSON.stringify({
              provider: account?.provider,
              email: user.email,
            }),
            success: true,
          },
        });
      } catch (error) {
        console.error("Failed to log sign-in:", error);
      }

      return true;
    },

    /**
     * JWT callback: Enrich token with role; promote configured admin emails
     */
    async jwt({ token, user, trigger }) {
      // On initial sign-in, user object is available
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (dbUser) {
          token.role = dbUser.role;
          token.sub = dbUser.id;

          // Promote configured admin emails (idempotent)
          if (
            dbUser.role !== UserRole.ADMIN &&
            ADMIN_EMAILS.includes(dbUser.email.toLowerCase())
          ) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { role: UserRole.ADMIN },
            });
            token.role = UserRole.ADMIN;
          }
        }
      }

      // On session update, refresh role from database
      if (trigger === "update" && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
        });

        if (dbUser) {
          token.role = dbUser.role;
        }
      }

      return token;
    },

    /**
     * Session callback: Expose role to client
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as UserRole) ?? UserRole.USER;
      }
      return session;
    },

    /**
     * Redirect callback: Handle post-sign-in redirects
     */
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) {
        return url;
      }
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      return `${baseUrl}/dashboard`;
    },
  },
  events: {
    /**
     * Log sign-out events
     */
    async signOut(message) {
      if ("token" in message && message.token?.sub) {
        try {
          await prisma.auditLog.create({
            data: {
              userId: message.token.sub,
              action: "USER_LOGOUT",
              resource: "auth",
              success: true,
            },
          });
        } catch (error) {
          console.error("Failed to log sign-out:", error);
        }
      }
    },
  },
};

/**
 * NextAuth route handler (v4)
 */
const handler = NextAuth(authOptions);
export const handlers = { GET: handler, POST: handler };

/**
 * Get the current session (server-side)
 * Compatible with both `auth()` calls and `getServerSession(authOptions)` calls
 */
export async function auth() {
  return nextAuthGetServerSession(authOptions);
}

export { auth as getServerSession };

/**
 * Re-export types
 */
export type { AuthSession } from "./types";
