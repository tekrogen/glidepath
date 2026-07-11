import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.PLAID_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('PLAID_ENCRYPTION_KEY environment variable is not set');
  }
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) {
    throw new Error('PLAID_ENCRYPTION_KEY must be a 32-byte (64 hex character) key');
  }
  return buf;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64 string: iv + ciphertext + authTag
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Concatenate: iv (12) + ciphertext (variable) + authTag (16)
  const result = Buffer.concat([iv, encrypted, authTag]);
  return result.toString('base64');
}

/**
 * Decrypt a base64 string produced by encrypt().
 */
export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedBase64, 'base64');

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
