// ============================================================
// Server-side Crypto Utils
// Generates random tokens and bytes (no plaintext encryption)
// The server NEVER decrypts file content
// ============================================================
const crypto = require('crypto');

/**
 * Generate a cryptographically secure random token.
 * Used for share links.
 */
function generateShareToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Generate a random storage filename (UUID-like, hex).
 */
function generateStorageName(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Compute SHA-256 hash of a buffer. Used for sync integrity.
 */
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

module.exports = { generateShareToken, generateStorageName, sha256, safeEqual };
