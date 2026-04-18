// ============================================================
// Share Controller — Create, Access, List, Revoke share links
// ============================================================
const argon2  = require('argon2');
const { PrismaClient }      = require('@prisma/client');
const { generateShareToken } = require('../utils/crypto.utils');
const { readFile }           = require('../services/storage.service');

const prisma = new PrismaClient();

// ── Create Share Link ─────────────────────────────────────
async function createShare(req, res, next) {
  try {
    const { fileId, expiresIn, maxAccess, password, shareKey, shareKeyIv, shareSalt } = req.body;

    const file = await prisma.file.findFirst({
      where: { id: fileId, userId: req.user.id, isDeleted: false },
    });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const token     = generateShareToken();
    let   expiresAt = null;
    if (expiresIn) expiresAt = new Date(Date.now() + expiresIn * 1000);

    let passwordHash = null;
    if (password) {
      passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    }

    const share = await prisma.share.create({
      data: {
        fileId,
        userId:   req.user.id,
        token,
        expiresAt,
        maxAccess: maxAccess || null,
        passwordHash,
        shareKey:   shareKey   || null,
        shareKeyIv: shareKeyIv || null,
        shareSalt:  shareSalt  || null,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        fileId,
        action: 'SHARE_CREATE',
        ip: req.ip,
        details: { token, expiresAt },
      },
    });

    const shareUrl = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/share/${token}`;
    res.status(201).json({ share: { id: share.id, token, shareUrl, expiresAt } });
  } catch (err) {
    next(err);
  }
}

// ── Access Shared File ────────────────────────────────────
async function accessShare(req, res, next) {
  try {
    const { token } = req.params;
    const { password } = req.body || {};

    const share = await prisma.share.findUnique({
      where:   { token },
      include: { file: true },
    });

    if (!share || share.isRevoked)
      return res.status(404).json({ error: 'Share link not found or revoked' });
    if (share.expiresAt && share.expiresAt < new Date())
      return res.status(410).json({ error: 'Share link has expired' });
    if (share.maxAccess && share.accessCount >= share.maxAccess)
      return res.status(410).json({ error: 'Share access limit reached' });
    if (share.file.isDeleted)
      return res.status(404).json({ error: 'Shared file no longer exists' });

    // Verify optional password
    if (share.passwordHash) {
      if (!password) return res.status(401).json({ error: 'Password required', code: 'PASSWORD_REQUIRED' });
      const valid = await argon2.verify(share.passwordHash, password);
      if (!valid) return res.status(401).json({ error: 'Incorrect share password' });
    }

    // Increment access count
    await prisma.share.update({
      where: { token },
      data:  { accessCount: { increment: 1 } },
    });

    // Log access
    await prisma.activityLog.create({
      data: {
        userId:  share.userId,
        fileId:  share.fileId,
        action:  'SHARE_ACCESS',
        ip:      req.ip,
        details: { token },
      },
    });

    // Return metadata + encrypted key info for recipient
    // Recipient uses shareKey (re-encrypted with share password) to decrypt
    res.json({
      filename:     share.file.filename,
      size:         share.file.size,
      mimeType:     share.file.mimeType,
      iv:           share.file.iv,
      shareKey:     share.shareKey,
      shareKeyIv:   share.shareKeyIv,
      shareSalt:    share.shareSalt,
      fileId:       share.fileId,
      accessCount:  share.accessCount + 1,
      expiresAt:    share.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

// ── Download via Share Token ──────────────────────────────
async function downloadShare(req, res, next) {
  try {
    const { token } = req.params;

    const share = await prisma.share.findUnique({
      where:   { token },
      include: { file: true },
    });

    if (!share || share.isRevoked || share.file.isDeleted)
      return res.status(404).json({ error: 'Share not found' });
    if (share.expiresAt && share.expiresAt < new Date())
      return res.status(410).json({ error: 'Share link expired' });

    const buffer = readFile(share.file.storagePath);

    res.set({
      'Content-Type':        'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(share.file.filename)}"`,
      'Content-Length':      buffer.length,
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// ── List My Shares ────────────────────────────────────────
async function listShares(req, res, next) {
  try {
    const shares = await prisma.share.findMany({
      where:   { userId: req.user.id, isRevoked: false },
      include: { file: { select: { filename: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ shares });
  } catch (err) {
    next(err);
  }
}

// ── Revoke Share Link ─────────────────────────────────────
async function revokeShare(req, res, next) {
  try {
    const { token } = req.params;

    const share = await prisma.share.findUnique({ where: { token } });
    if (!share || share.userId !== req.user.id)
      return res.status(404).json({ error: 'Share not found' });

    await prisma.share.update({ where: { token }, data: { isRevoked: true } });

    await prisma.activityLog.create({
      data: { userId: req.user.id, fileId: share.fileId, action: 'SHARE_REVOKE', ip: req.ip },
    });

    res.json({ message: 'Share link revoked' });
  } catch (err) {
    next(err);
  }
}

module.exports = { createShare, accessShare, downloadShare, listShares, revokeShare };
