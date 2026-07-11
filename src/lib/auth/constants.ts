/**
 * Auth Constants
 *
 * Permission-based RBAC, route configuration, and role mappings.
 *
 * RBAC Mental Model:
 * - USER  = the customer. Owns their financial data and Plaid connections.
 * - ADMIN = platform operator. Has NO financial data access.
 * - USER and ADMIN permissions do NOT overlap (orthogonal domains).
 */

import { UserRole } from "@prisma/client";

/**
 * Permission types for the RBAC system.
 *
 * Organized by domain:
 * - financial:* — Access to financial data (accounts, transactions, budgets, etc.)
 * - plaid:*     — Manage Plaid account connections
 * - admin:*     — Platform administration (user management, audit, settings)
 */
export type Permission =
  | "financial:read"
  | "financial:write"
  | "financial:delete"
  | "financial:export"
  | "plaid:manage"
  | "admin:users"
  | "admin:audit"
  | "admin:settings";

/**
 * Role-to-permission mapping.
 *
 * USER and ADMIN permissions are disjoint by design — a platform admin
 * should never access customer financial data, and a customer should
 * never manage platform settings.
 */
export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  USER: new Set([
    "financial:read",
    "financial:write",
    "financial:delete",
    "financial:export",
    "plaid:manage",
  ]),
  ADMIN: new Set(["admin:users", "admin:audit", "admin:settings"]),
} as const;

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(
  userRole: UserRole,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[userRole].has(permission);
}

/**
 * Check if a role has at least one of the given permissions.
 */
export function hasAnyPermission(
  userRole: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => ROLE_PERMISSIONS[userRole].has(p));
}

/**
 * Public routes accessible without authentication
 */
export const PUBLIC_ROUTES = ["/", "/signin", "/api/auth"] as const;

/**
 * Routes that require authentication but no specific role
 */
export const AUTH_ROUTES = ["/signout", "/unauthorized"] as const;

/**
 * Routes requiring ADMIN role
 */
export const ADMIN_ROUTES = ["/admin"] as const;

/**
 * Default redirect paths based on role
 */
export const ROLE_DEFAULT_REDIRECTS: Record<UserRole, string> = {
  USER: "/dashboard",
  ADMIN: "/dashboard",
} as const;

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  updateAge: 24 * 60 * 60, // 24 hours in seconds
} as const;
