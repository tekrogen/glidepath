/**
 * NextAuth Type Augmentations
 *
 * Extends NextAuth types to include the user role.
 * These types are used throughout the application for type-safe auth state.
 */

import type { UserRole } from "@prisma/client";
import type { Session, User, DefaultSession } from "next-auth";

/**
 * Extended User type with role
 */
export interface ExtendedUser extends User {
  role: UserRole;
}

/**
 * Extend the built-in session types
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
  }
}

/**
 * Auth session result type for use in components
 */
export type AuthSession = Session | null;

/**
 * Type guard to check if user is authenticated
 */
export function isAuthenticated(
  session: AuthSession
): session is NonNullable<AuthSession> {
  return session !== null && session.user !== null;
}
