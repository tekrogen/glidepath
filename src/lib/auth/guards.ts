/**
 * API Route Guards (Security Layer)
 *
 * Provides server-side route protection for API endpoints.
 * This is part of the dual enforcement pattern:
 * - Pages: UX layer (redirects)
 * - Guards: Security layer (401/403 responses)
 *
 * Uses permission-based RBAC — ADMIN and USER are orthogonal domains.
 */

import { NextResponse } from "next/server";

import { auth } from "./index";
import { hasPermission, type Permission } from "./constants";
import type { AuthSession } from "./types";

/**
 * Unauthorized response (401)
 */
export function unauthorizedResponse(message = "Authentication required") {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Forbidden response (403)
 */
export function forbiddenResponse(message = "Insufficient permissions") {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Guard result type
 */
export type GuardResult =
  | { success: true; session: NonNullable<AuthSession> }
  | { success: false; response: NextResponse };

/**
 * Require authentication for an API route
 *
 * @example
 * ```ts
 * export async function GET() {
 *   const guard = await requireAuth();
 *   if (!guard.success) return guard.response;
 *   const { session } = guard;
 *   // ... use session.user
 * }
 * ```
 */
export async function requireAuth(): Promise<GuardResult> {
  const session = await auth();

  if (!session?.user) {
    return { success: false, response: unauthorizedResponse() };
  }

  return { success: true, session: session as NonNullable<AuthSession> };
}

/**
 * Require a specific permission for an API route.
 *
 * @example
 * ```ts
 * export async function GET() {
 *   const guard = await requirePermission('financial:read');
 *   if (!guard.success) return guard.response;
 *   const { session } = guard;
 *   // ... user has financial read access
 * }
 * ```
 */
export async function requirePermission(
  permission: Permission
): Promise<GuardResult> {
  const authResult = await requireAuth();

  if (!authResult.success) {
    return authResult;
  }

  if (!hasPermission(authResult.session.user.role, permission)) {
    return {
      success: false,
      response: forbiddenResponse(
        `Missing required permission: ${permission}`
      ),
    };
  }

  return authResult;
}

/**
 * Require financial data access (USER).
 * ADMIN is excluded — they have no financial data access.
 */
export async function requireUser(): Promise<GuardResult> {
  return requirePermission("financial:read");
}

/**
 * Require ADMIN role (platform management).
 * USER is excluded.
 */
export async function requireAdmin(): Promise<GuardResult> {
  return requirePermission("admin:users");
}

/**
 * Type helper for extracting session from guard result
 */
export function assertGuardSuccess(
  result: GuardResult
): asserts result is { success: true; session: NonNullable<AuthSession> } {
  if (!result.success) {
    throw new Error("Guard assertion failed");
  }
}
