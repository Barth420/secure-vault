// ============================================================
// File Controller — Upload, Download, Delete, List, Versions
// ALL file content is encrypted by the client.
// Server stores and serves opaque encrypted blobs.
// ============================================================
const fs   = require('fs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { saveFile, streamFile, deleteFile, fileSize } = require('../services/storage.service');
const { generateStorageName } = require('../utils/crypto.utils');

const prisma = new PrismaClient();

// ── SHA-256 via stream (no RAM load) ─────────────────────────
function sha256Stream(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end',  () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ── Upload Encrypted File ────────────────────────────────────
async function upload(req, res, next) {
  let tempPath = req.file?.path; // disk storage path
  try {
    const { filename, mimeType, iv, encryptedKey, keyIv } = req.body;

    if (!req.file)     return res.status(400).json({ error: 'No file uploaded' });
    if (!filename)     return res.status(400).json({ error: 'filename is required' });
    if (!iv)           return res.status(400).json({ error: 'iv is required' });
    if (!encryptedKey) return res.status(400).json({ error: 'encryptedKey is required' });
    if (!keyIv)        return res.status(400).json({ error: 'keyIv is required' });

    // Hash the file without loading into RAM
    const hash = await sha256Stream(tempPath);
    const size = req.file.size;

    // Check duplicate
    const existing = await prisma.file.findFirst({
      where: { userId: req.user.id, hash, isDeleted: false },
    });
    if (existing) {
      fs.unlinkSync(tempPath); // clean up temp file
      return res.status(409).json({ error: 'Identical file already uploaded', fileId: existing.id });
    }

    // Move temp file to permanent storage (rename = instant, no copy)
    const storageName = generateStorageName();
    const storagePath = await saveFile(tempPath, storageName);
    tempPath = null; // no longer needs cleanup

    // Persist metadata to DB
    const file = await prisma.file.create({
      data: {
        userId:       req.user.id,
        filename,
        storagePath,
        size,
        mimeType:     mimeType || 'application/octet-stream',
        hash,
        iv,
        encryptedKey,
        keyIv,
        version:      1,
      },
    });

    // Version record
    await prisma.fileVersion.create({
      data: { fileId: file.id, storagePath, size, hash, iv, encryptedKey, keyIv, version: 1 },
    });

    // Activity log
    await prisma.activityLog.create({
      data: { userId: req.user.id, fileId: file.id, action: 'UPLOAD', ip: req.ip,
              details: { filename, size } },
    });

    res.status(201).json({ file: sanitizeFile(file) });
  } catch (err) {
    // Clean up temp file if something went wrong mid-upload
    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
    next(err);
  }
}

// ── Download Encrypted Blob (streaming) ──────────────────────
async function download(req, res, next) {
  try {
    const { id } = req.params;

    const file = await prisma.file.findFirst({
      where: { id, userId: req.user.id, isDeleted: false },
    });
    if (!file) return res.status(404).json({ error: 'File not found' });

    await prisma.activityLog.create({
      data: { userId: req.user.id, fileId: file.id, action: 'DOWNLOAD', ip: req.ip },
    });

    // Stream the blob — never loads full file into RAM
    const stream = streamFile(file.storagePath, res);

    res.set({
      'Content-Type':         'application/octet-stream',
      'Content-Disposition':  `attachment; filename="${encodeURIComponent(file.filename)}"`,
      'Content-Length':       file.size,
      'X-File-IV':            file.iv,
      'X-File-Encrypted-Key': file.encryptedKey,
      'X-File-Key-IV':        file.keyIv,
    });

    stream.pipe(res);
    stream.on('error', next);
  } catch (err) {
    next(err);
  }
}

// ── List User Files ───────────────────────────────────────────
async function list(req, res, next) {
  try {
    const files = await prisma.file.findMany({
      where:   { userId: req.user.id, isDeleted: false },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, filename: true, size: true, mimeType: true,
        hash: true, iv: true, encryptedKey: true, keyIv: true,
        version: true, createdAt: true, updatedAt: true,
        _count: { select: { shares: true } },
      },
    });
    res.json({ files });
  } catch (err) {
    next(err);
  }
}

// ── Soft Delete ───────────────────────────────────────────────
async function remove(req, res, next) {
  try {
    const { id } = req.params;

    const file = await prisma.file.findFirst({
      where: { id, userId: req.user.id, isDeleted: false },
    });
    if (!file) return res.status(404).json({ error: 'File not found' });

    await prisma.file.update({ where: { id }, data: { isDeleted: true } });
    await prisma.activityLog.create({
      data: { userId: req.user.id, fileId: file.id, action: 'DELETE', ip: req.ip },
    });

    res.json({ message: 'File deleted' });
  } catch (err) {
    next(err);
  }
}

// ── Get File Versions ─────────────────────────────────────────
async function versions(req, res, next) {
  try {
    const { id } = req.params;
    const file = await prisma.file.findFirst({ where: { id, userId: req.user.id } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const versionList = await prisma.fileVersion.findMany({
      where: { fileId: id }, orderBy: { version: 'desc' },
    });
    res.json({ versions: versionList });
  } catch (err) {
    next(err);
  }
}

// ── Restore Version ───────────────────────────────────────────
async function restoreVersion(req, res, next) {
  try {
    const { id, versionId } = req.params;
    const file    = await prisma.file.findFirst({ where: { id, userId: req.user.id } });
    if (!file) return res.status(404).json({ error: 'File not found' });
    const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId: id } });
    if (!version) return res.status(404).json({ error: 'Version not found' });

    const updated = await prisma.file.update({
      where: { id },
      data: {
        storagePath:  version.storagePath,
        size:         version.size,
        hash:         version.hash,
        iv:           version.iv,
        encryptedKey: version.encryptedKey,
        keyIv:        version.keyIv,
        version:      file.version + 1,
      },
    });

    res.json({ file: sanitizeFile(updated), restoredFrom: version.version });
  } catch (err) {
    next(err);
  }
}

// ── Helper ────────────────────────────────────────────────────
function sanitizeFile(f) {
  const { storagePath, ...safe } = f;
  return safe;
}

module.exports = { upload, download, list, remove, versions, restoreVersion };
