// ============================================================
// Storage Service — Filesystem abstraction layer
// Swap this out for S3/MinIO later without touching controllers
// ============================================================
const fs   = require('fs');
const path = require('path');

const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(__dirname, '../../storage');

// Ensure root exists
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

/**
 * Save a buffer to storage.
 * @returns {string} relative path within STORAGE_ROOT
 */
async function saveFile(buffer, filename) {
  const dir      = path.join(STORAGE_ROOT, filename.substring(0, 2));
  const fullPath = path.join(dir, filename);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, buffer);
  return path.join(filename.substring(0, 2), filename);
}

/**
 * Read a file from storage. Returns a Buffer.
 */
function readFile(relativePath) {
  const fullPath = path.join(STORAGE_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) throw Object.assign(new Error('File not found in storage'), { status: 404 });
  return fs.readFileSync(fullPath);
}

/**
 * Delete a file from storage.
 */
function deleteFile(relativePath) {
  const fullPath = path.join(STORAGE_ROOT, relativePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

/**
 * Check if a file exists in storage.
 */
function fileExists(relativePath) {
  return fs.existsSync(path.join(STORAGE_ROOT, relativePath));
}

module.exports = { saveFile, readFile, deleteFile, fileExists, STORAGE_ROOT };
