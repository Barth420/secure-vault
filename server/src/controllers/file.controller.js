// ============================================================
// File Controller — Upload, Download, Delete, List, Versions
// ALL file content is encrypted by the client.
// Server stores and serves opaque encrypted blobs.
// ============================================================
const { PrismaClient } = require('@prisma/client');
const { saveFile, readFile, deleteFile } = require('../services/storage.service');
const { generateStorageName, sha256 }    = require('../utils/crypto.utils');

const prisma = new PrismaClient();

// ── Upload Encrypted File ────────────────────────────────
async function upload(req, res, next) {
  try {
    const { filename, mimeType, iv, encryptedKey, keyIv } = req.body;

    if (!req.file)       return res.status(400).json({ error: 'No file uploaded' });
    if (!filename)       return res.status(400).json({ error: 'filename is required' });
    if (!iv)             return res.status(400).json({ error: 'iv is required' });
    if (!encryptedKey)   return res.status(400).json({ error: 'encryptedKey is required' });
    if (!keyIv)          return res.status(400).json({ error: 'keyIv is required' });

    const buffer      = req.file.buffer;
    const storageName = generateStorageName();
    const hash        = sha256(buffer);
    const size        = buffer.length;

    // Check if a non-deleted file with same hash exists for this user
    const existing = await prisma.file.findFirst({
      where: { userId: req.user.id, hash, isDeleted: false },
    });
    if (existing) {
      return res.status(409).json({ error: 'Identical file already uploaded', fileId: existing.id });
    }

    // Save encrypted blob to storage
    const storagePath = await saveFile(buffer, storageName);

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

    // Create initial version record
    await prisma.fileVersion.create({
      data: {
        fileId:      file.id,
        storagePath,
        size,
        hash,
        iv,
        encryptedKey,
        keyIv,
        version:     1,
      },
    });

    // Log
    await prisma.activityLog.create({
      data: { userId: req.user.id, fileId: file.id, action: 'UPLOAD', ip: req.ip,
              details: { filename, size } },
    });

    res.status(201).json({ file: sanitizeFile(file) });
  } catch (err) {
    next(err);
  }
}

// ── Download Encrypted Blob ──────────────────────────────
async function download(req, res, next) {
  try {
    const { id } = req.params;

    const file = await prisma.file.findFirst({
      where: { id, userId: req.user.id, isDeleted: false },
    });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const buffer = readFile(file.storagePath);

    await prisma.activityLog.create({
      data: { userId: req.user.id, fileId: file.id, action: 'DOWNLOAD', ip: req.ip },
    });

    // Send encrypted blob — client decrypts it
    res.set({
      'Content-Type':        'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`,
      'Content-Length':      buffer.length,
      'X-File-IV':           file.iv,
      'X-File-Encrypted-Key': file.encryptedKey,
      'X-File-Key-IV':       file.keyIv,
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// ── List User Files ───────────────────────────────────────
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

// ── Soft Delete ───────────────────────────────────────────
async function remove(req, res, next) {
  try {
    const { id } = req.params;

    const file = await prisma.file.findFirst({
      where: { id, userId: req.user.id, isDeleted: false },
    });
    if (!file) return res.status(404).json({ error: 'File not found' });

    await prisma.file.update({
      where: { id },
      data:  { isDeleted: true },
    });

    await prisma.activityLog.create({
      data: { userId: req.user.id, fileId: file.id, action: 'DELETE', ip: req.ip },
    });

    res.json({ message: 'File deleted' });
  } catch (err) {
    next(err);
  }
}

// ── Get File Versions ─────────────────────────────────────
async function versions(req, res, next) {
  try {
    const { id } = req.params;

    const file = await prisma.file.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const versionList = await prisma.fileVersion.findMany({
      where:   { fileId: id },
      orderBy: { version: 'desc' },
    });

    res.json({ versions: versionList });
  } catch (err) {
    next(err);
  }
}

// ── Restore Version ───────────────────────────────────────
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

// ── Helper: strip internal fields ─────────────────────────
function sanitizeFile(f) {
  const { storagePath, ...safe } = f;
  return safe;
}

module.exports = { upload, download, list, remove, versions, restoreVersion };
