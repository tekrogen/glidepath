/**
 * Plaid Webhook Signature Verifier
 *
 * Verifies incoming Plaid webhook requests using JWT/JWK verification, per
 * https://plaid.com/docs/api/webhooks/webhook-verification/
 *
 * Plaid signs each webhook with an ES256 JWT in the `Plaid-Verification` header.
 * The JWT's `request_body_sha256` claim is the SHA-256 of the raw request body, so
 * verifying the signature AND matching that hash proves both authenticity and that
 * the body was not tampered with in transit.
 */

import { createHash, timingSafeEqual } from 'crypto';
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from 'jose';

import { getPlaidClient, plaidCredentials } from './plaid-service';

interface VerificationResult {
  verified: boolean;
  reason?: string;
}

// Reject webhooks whose JWT is older than this to bound replay attacks.
const MAX_TOKEN_AGE_SECONDS = 5 * 60;

// Cache resolved verification keys by key id — Plaid rotates them infrequently and
// re-fetching on every webhook would add a Plaid API round trip to each request.
const keyCache = new Map<string, JWK>();

async function getVerificationKey(keyId: string): Promise<JWK | null> {
  const cached = keyCache.get(keyId);
  if (cached) return cached;

  const client = getPlaidClient();
  // Plaid's client carries no baked-in credentials; every call must pass them
  // in the request body via plaidCredentials(). Without this the key fetch is
  // unauthenticated, verification fails, and every webhook returns 401.
  const response = await client.webhookVerificationKeyGet({
    ...plaidCredentials(),
    key_id: keyId,
  });
  const key = response.data.key as unknown as JWK;

  // Plaid marks retired keys with an `expired_at`; don't trust or cache those.
  if ((key as { expired_at?: unknown }).expired_at) {
    return null;
  }

  keyCache.set(keyId, key);
  return key;
}

/**
 * Verify a Plaid webhook request signature.
 *
 * @param rawBody - The raw request body string (before JSON parsing)
 * @param headers - The request headers (contains the Plaid-Verification JWT)
 * @returns Verification result
 */
export async function verifyPlaidWebhook(
  rawBody: string,
  headers: Headers
): Promise<VerificationResult> {
  const verificationHeader = headers.get('plaid-verification');

  if (!verificationHeader) {
    // Fail closed. Verification may only be skipped when it is EXPLICITLY opted
    // into via PLAID_WEBHOOK_SKIP_VERIFY=true — never implicitly by NODE_ENV.
    // The app is served publicly through the Cloudflare tunnel by `next dev`
    // (NODE_ENV=development), so NODE_ENV must never gate an auth control.
    if (process.env.PLAID_WEBHOOK_SKIP_VERIFY === 'true') {
      return { verified: true, reason: 'Skipped via PLAID_WEBHOOK_SKIP_VERIFY' };
    }
    return { verified: false, reason: 'Missing Plaid-Verification header' };
  }

  // 1. Decode the JWT header to get the key id, and pin the algorithm to ES256 so a
  //    forged token can't downgrade to `alg: none` or an HMAC using the public key.
  let keyId: string;
  try {
    const protectedHeader = decodeProtectedHeader(verificationHeader);
    if (protectedHeader.alg !== 'ES256') {
      return { verified: false, reason: `Unexpected JWT alg: ${protectedHeader.alg}` };
    }
    if (!protectedHeader.kid) {
      return { verified: false, reason: 'Missing kid in JWT header' };
    }
    keyId = protectedHeader.kid;
  } catch {
    return { verified: false, reason: 'Malformed Plaid-Verification JWT' };
  }

  // 2. Fetch Plaid's public key for that kid.
  let jwk: JWK | null;
  try {
    jwk = await getVerificationKey(keyId);
  } catch (error) {
    return {
      verified: false,
      reason: `Could not fetch verification key: ${
        error instanceof Error ? error.message : 'unknown'
      }`,
    };
  }
  if (!jwk) {
    return { verified: false, reason: 'Verification key not found or expired' };
  }

  // 3. Verify the JWT signature (and freshness) with the public key.
  let bodyHashClaim: string;
  try {
    const publicKey = await importJWK(jwk, 'ES256');
    const { payload } = await jwtVerify(verificationHeader, publicKey, {
      algorithms: ['ES256'],
      maxTokenAge: MAX_TOKEN_AGE_SECONDS,
    });

    const claim = payload['request_body_sha256'];
    if (typeof claim !== 'string') {
      return { verified: false, reason: 'Missing request_body_sha256 claim' };
    }
    bodyHashClaim = claim;
  } catch (error) {
    return {
      verified: false,
      reason: `JWT verification failed: ${
        error instanceof Error ? error.message : 'unknown'
      }`,
    };
  }

  // 4. Confirm the claimed body hash matches the actual body (timing-safe).
  const computedHash = createHash('sha256').update(rawBody, 'utf8').digest('hex');
  const claimBuf = Buffer.from(bodyHashClaim);
  const computedBuf = Buffer.from(computedHash);
  if (
    claimBuf.length !== computedBuf.length ||
    !timingSafeEqual(claimBuf, computedBuf)
  ) {
    return { verified: false, reason: 'Request body hash mismatch' };
  }

  return { verified: true };
}
