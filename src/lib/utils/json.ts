/**
 * JSON Utilities
 *
 * Safe JSON parsing utilities with proper error handling.
 * Provides consistent fallback behavior across the application.
 */

/**
 * Safely parse a JSON string with a default fallback value
 *
 * @param json - The JSON string to parse (can be null/undefined)
 * @param defaultValue - The value to return if parsing fails
 * @returns The parsed object or the default value
 *
 * @example
 * ```ts
 * // With object default
 * const details = safeJsonParse(log.details, {});
 *
 * // With typed default
 * interface UserDetails { provider?: string; email?: string; }
 * const details = safeJsonParse<UserDetails>(log.details, {});
 *
 * // With array default
 * const items = safeJsonParse(jsonString, []);
 * ```
 */
export function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) {
    return defaultValue;
  }

  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely parse a JSON string, returning null on failure
 *
 * @param json - The JSON string to parse
 * @returns The parsed object or null if parsing fails
 *
 * @example
 * ```ts
 * const data = safeJsonParseOrNull(jsonString);
 * if (data) {
 *   // Handle parsed data
 * }
 * ```
 */
export function safeJsonParseOrNull<T>(json: string | null | undefined): T | null {
  if (!json) {
    return null;
  }

  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
