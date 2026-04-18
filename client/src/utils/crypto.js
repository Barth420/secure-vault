// ============================================================
// Client-Side Encryption Utility
// AES-256-GCM + PBKDF2 + Per-file keys
//
// Security model:
//   1. Master key = PBKDF2(password, salt) — derived each session
//   2. Each file gets a unique random 256-bit AES key
//   3. File key is encrypted with master key → stored on server
//   4. Server stores only: encrypted blob + encrypted key + IV
//   5. Server can NEVER decrypt files — zero knowledge
// ============================================================

const PBKDF2_ITERATIONS = 310_000;   // NIST recommended minimum 2023
const KEY_LENGTH        = 256;       // AES-256

// ── Master Key Derivation ─────────────────────────────────

/**
 * Derive the master AES-GCM key from the user's password and server-provided salt.
 * The result is kept only in memory (never serialized).
 * @param {string} password  - User's plaintext password
 * @param {string} saltB64   - Base64-encoded salt from server
 * @returns {Promise<CryptoKey>}
 */
export async function deriveMasterKey(password, saltB64) {
  const enc      = new TextEncoder();
  const salt     = base64ToBuffer(saltB64);
  const keyMat   = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMat,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,        // not extractable — can't be exported from memory
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

// ── Per-File Key Generation ───────────────────────────────

/**
 * Generate a fresh random AES-256-GCM key for a single file.
 * @returns {Promise<CryptoKey>}
 */
export async function generateFileKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: KEY_LENGTH },
    true,         // extractable so we can wrap it
    ['encrypt', 'decrypt']
  );
}

// ── Key Wrapping (encrypt file key with master key) ───────

/**
 * Encrypt (wrap) a file key with the master key.
 * The wrapped key + its IV are stored on the server.
 * @returns {{ encryptedKey: string, keyIv: string }}  (Base64)
 */
export async function wrapFileKey(fileKey, masterKey) {
  const iv          = crypto.getRandomValues(new Uint8Array(12));
  const rawFileKey  = await crypto.subtle.exportKey('raw', fileKey);
  const wrapped     = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    rawFileKey
  );
  return {
    encryptedKey: bufferToBase64(wrapped),
    keyIv:        bufferToBase64(iv),
  };
}

/**
 * Decrypt (unwrap) a file key using the master key.
 * @returns {Promise<CryptoKey>}
 */
export async function unwrapFileKey(encryptedKeyB64, keyIvB64, masterKey) {
  const iv         = base64ToBuffer(keyIvB64);
  const wrapped    = base64ToBuffer(encryptedKeyB64);
  const rawFileKey = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    wrapped
  );
  return crypto.subtle.importKey(
    'raw', rawFileKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    true,   // extractable: must be true so createShareKey() can export it
    ['encrypt', 'decrypt']
  );
}

// ── File Encryption ───────────────────────────────────────

/**
 * Encrypt a file buffer with a per-file key.
 * @param {ArrayBuffer} fileBuffer  - Plaintext file bytes
 * @param {CryptoKey}   masterKey   - Derived from user's password
 * @returns {{ ciphertext: ArrayBuffer, iv: string, encryptedKey: string, keyIv: string }}
 */
export async function encryptFile(fileBuffer, masterKey) {
  const fileKey = await generateFileKey();
  const iv      = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    fileKey,
    fileBuffer
  );

  const { encryptedKey, keyIv } = await wrapFileKey(fileKey, masterKey);

  return {
    ciphertext,
    iv:           bufferToBase64(iv),
    encryptedKey,
    keyIv,
  };
}

/**
 * Decrypt a file buffer.
 * @param {ArrayBuffer} ciphertext
 * @param {string}      ivB64          - Base64 IV
 * @param {string}      encryptedKeyB64 - Base64 wrapped file key
 * @param {string}      keyIvB64        - Base64 key IV
 * @param {CryptoKey}   masterKey
 * @returns {Promise<ArrayBuffer>}  plaintext bytes
 */
export async function decryptFile(ciphertext, ivB64, encryptedKeyB64, keyIvB64, masterKey) {
  const fileKey = await unwrapFileKey(encryptedKeyB64, keyIvB64, masterKey);
  const iv      = base64ToBuffer(ivB64);

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    fileKey,
    ciphertext
  );
}

// ── Share Key (for zero-knowledge sharing) ────────────────

/**
 * Re-encrypt a file's wrapped key with a share password.
 * The recipient only needs the share password, not the user's master password.
 */
export async function createShareKey(encryptedKeyB64, keyIvB64, masterKey, sharePassword) {
  // First, unwrap to get the raw file key
  const fileKey = await unwrapFileKey(encryptedKeyB64, keyIvB64, masterKey);

  // Derive a key from the share password
  const enc      = new TextEncoder();
  const salt     = crypto.getRandomValues(new Uint8Array(16));
  const keyMat   = await crypto.subtle.importKey(
    'raw', enc.encode(sharePassword), 'PBKDF2', false, ['deriveKey']
  );
  const shareKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Wrap file key with share key
  const iv         = crypto.getRandomValues(new Uint8Array(12));
  const rawFileKey = await crypto.subtle.exportKey('raw', fileKey);
  const wrapped    = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, shareKey, rawFileKey);

  return {
    shareKey:   bufferToBase64(wrapped),
    shareKeyIv: bufferToBase64(iv),
    shareSalt:  bufferToBase64(salt),
  };
}

/**
 * Decrypt a file using only the share password (no master key needed).
 */
export async function decryptWithShareKey(ciphertext, ivB64, shareKeyB64, shareKeyIvB64, shareSaltB64, sharePassword) {
  const enc      = new TextEncoder();
  const salt     = base64ToBuffer(shareSaltB64);
  const keyMat   = await crypto.subtle.importKey(
    'raw', enc.encode(sharePassword), 'PBKDF2', false, ['deriveKey']
  );
  const shareKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const wrappedFileKey = base64ToBuffer(shareKeyB64);
  const keyIv          = base64ToBuffer(shareKeyIvB64);
  const rawFileKey     = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: keyIv }, shareKey, wrappedFileKey);

  const fileKey  = await crypto.subtle.importKey('raw', rawFileKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const fileIv   = base64ToBuffer(ivB64);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fileIv }, fileKey, ciphertext);
}

// ── SHA-256 Hash (for sync integrity check) ───────────────

/**
 * Compute SHA-256 of an ArrayBuffer and return hex string.
 */
export async function sha256(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Helpers ───────────────────────────────────────────────

export function bufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary  = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToBuffer(b64) {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Trigger a browser download of a plaintext buffer.
 */
export function downloadBlob(buffer, filename, mimeType = 'application/octet-stream') {
  const blob = new Blob([buffer], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
