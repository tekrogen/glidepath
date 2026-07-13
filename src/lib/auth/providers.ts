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
 * Empty-state fixture user (issue #29). A bare account with NO household
 * membership, so its portfolio is empty by construction and the first-run /
 * empty states render. E2E-only: it is NOT in the sign-in autofill or the
 * 3-place demo-credential sync — only the ENABLE_DEMO_AUTH allowlist below.
 */
export const EMPTY_DEMO_USER = {
  email: "empty@glidepath.cards",
  password: "demo-password",
  name: "Fresh User",
} as const;

/** The identities the demo credentials provider accepts. */
const DEMO_IDENTITIES = [DEMO_USER, EMPTY_DEMO_USER] as const;

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

          // Match against every allowed identity without an early return, so
          // the accepted-identity count never leaks via timing.
          let identity: (typeof DEMO_IDENTITIES)[number] | null = null;
          for (const candidate of DEMO_IDENTITIES) {
            if (safeEqual(candidate.email, email) && safeEqual(candidate.password, password)) {
              identity = candidate;
            }
          }
          if (!identity) {
            return null;
          }

          // Find or create the matched user (db:seed creates both)
          let user = await prisma.user.findUnique({
            where: { email: identity.email },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: identity.email,
                name: identity.name,
                role: UserRole.USER,
                emailVerified: new Date(),
              },
            });
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? identity.name,
            image: user.image ?? undefined,
          };
        },
      })
    );
  }

  return providers;
}
