/**
 * Auth Error Messages
 *
 * Centralized error messages for OAuth and authentication errors.
 * Used by sign-in pages and forms to display user-friendly error messages.
 *
 * @see https://authjs.dev/reference/core/errors
 */

/**
 * Map of NextAuth error codes to user-friendly messages
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Error starting OAuth sign-in. Please try again.",
  OAuthCallback: "Error during OAuth callback. Please try again.",
  OAuthCreateAccount: "Could not create OAuth account. Please try again.",
  EmailCreateAccount: "Could not create email account. Please try again.",
  Callback: "Error during callback. Please try again.",
  OAuthAccountNotLinked:
    "This email is already associated with another account. Please sign in with the original provider.",
  EmailSignin: "Error sending email. Please try again.",
  CredentialsSignin: "Invalid credentials. Please try again.",
  SessionRequired: "Please sign in to access this page.",
  AccessDenied: "Access denied. You may not have permission to sign in.",
  Default: "An error occurred. Please try again.",
};

/**
 * Get the error message for a given error code
 * Falls back to Default message if code is not found
 */
export function getAuthErrorMessage(errorCode: string | null | undefined): string | null {
  if (!errorCode) return null;
  return AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES.Default ?? null;
}
