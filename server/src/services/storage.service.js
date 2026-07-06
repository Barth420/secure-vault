// ============================================================
// Storage Service — Filesystem abstraction layer
// Uses streaming and fs.rename for large file support.
// Swap this out for S3/MinIO later without touching controllers.
// ============================================================
const fs   = require('fs');
const path = require('path');

const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(__dirname, '../../storage');

// Ensure root exists
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

/**
 * Move a temp file (from Multer diskStorage) into permanent storage.
 * Uses fs.rename (instant if same filesystem) or stream-copy fallback.
 * @param {string} tempPath  - absolute path to the temp file
 * @param {string} filename  - storage filename (generated UUID)
 * @returns {string} relative path within STORAGE_ROOT
 */
async function saveFile(tempPath, filename) {
  const dir      = path.join(STORAGE_ROOT, filename.substring(0, 2));
  const fullPath = path.join(dir, filename);
  fs.mkdirSync(dir, { recursive: true });

  try {
    // Fast path: rename within same filesystem (O(1), no data copy)
    fs.renameSync(tempPath, fullPath);
  } catch (err) {
    // Fallback: cross-device move (stream copy then delete source)
    await streamCopy(tempPath, fullPath);
    fs.unlinkSync(tempPath);
  }

  return path.join(filename.substring(0, 2), filename);
}

/**
 * Stream a file from storage to an HTTP response.
 * Does NOT load the whole file into memory.
 * @param {string} relativePath
 * @param {object} res - Express response object
 */
function streamFile(relativePath, res) {
  const fullPath = path.join(STORAGE_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw Object.assign(new Error('File not found in storage'), { status: 404 });
  }
  return fs.createReadStream(fullPath);
}

/**
 * Read a small file into a Buffer (kept for backward compat / hashing).
 * Avoid for files > 100MB.
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

/**
 * Get file size in bytes without reading the file.
 */
function fileSize(relativePath) {
  const fullPath = path.join(STORAGE_ROOT, relativePath);
  return fs.statSync(fullPath).size;
}

// ── Internal: cross-device stream copy ───────────────────────
function streamCopy(src, dest) {
  return new Promise((resolve, reject) => {
    const r = fs.createReadStream(src);
    const w = fs.createWriteStream(dest);
    r.on('error', reject);
    w.on('error', reject);
    w.on('finish', resolve);
    r.pipe(w);
  });
}

module.exports = { saveFile, streamFile, readFile, deleteFile, fileExists, fileSize, STORAGE_ROOT };
