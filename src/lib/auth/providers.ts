/**
 * Auth Provider Configuration
 *
 * Google and GitHub OAuth providers register only when their env vars are set,
 * so the app boots with zero OAuth configuration.
 *
 * The demo Credentials provider (ENABLE_DEMO_AUTH=true) powers the seeded
 * demo account. Its credentials are public constants — anyone can sign in to
 * the demo user. That is intentional for a sales/preview deployment, but you
 * MUST set ENABLE_DEMO_AUTH=false before deploying with real user data.
 */

import { timingSafeEqual } from "crypto";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { AuthOptions } from "next-auth";
import { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

type Provider = AuthOptions["providers"][number];

/**
 * Demo login credentials (only used when ENABLE_DEMO_AUTH=true).
 * These are PUBLIC constants matching the user created by `pnpm db:seed`.
 */
export const DEMO_USER = {
  email: "demo@glidepath.cards",
  password: "demo-password",
  name: "Demo User",
} as const;

/**
 * Constant-time string comparison to avoid leaking match length/position via timing.
 * Returns false on any length mismatch (timingSafeEqual requires equal-length buffers).
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Configure and return all auth providers
 */
export function getProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        authorization: {
          params: {
            prompt: "consent",
            access_type: "offline",
            response_type: "code",
          },
        },
      })
    );
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      })
    );
  }

  // Demo credentials provider. Unlike a test-only provider, this is allowed in
  // production builds so a deployed sales demo can offer one-click sign-in.
  // The demo user only ever sees seeded data — but disable it when real users
  // and real Plaid data enter the picture.
  if (process.env.ENABLE_DEMO_AUTH === "true") {
    console.warn(
      "[auth] Demo credentials provider is ENABLED (public demo login). " +
        "Set ENABLE_DEMO_AUTH=false before deploying with real user data."
    );
    providers.push(
      Credentials({
        id: "demo-credentials",
        name: "Demo Account",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;

          if (
            !safeEqual(DEMO_USER.email, email) ||
            !safeEqual(DEMO_USER.password, password)
          ) {
            return null;
          }

          // Find or create the demo user (db:seed creates it with full data)
          let user = await prisma.user.findUnique({
            where: { email: DEMO_USER.email },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: DEMO_USER.email,
                name: DEMO_USER.name,
                role: UserRole.USER,
                emailVerified: new Date(),
              },
            });
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? DEMO_USER.name,
            image: user.image ?? undefined,
          };
        },
      })
    );
  }

  return providers;
}
