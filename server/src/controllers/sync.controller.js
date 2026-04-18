// ============================================================
// Sync Controller — Delta sync for multi-device support
// ============================================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── Delta Sync — get all files changed since a timestamp ──
async function delta(req, res, next) {
  try {
    const { since } = req.query;  // ISO timestamp or epoch ms

    let sinceDate = since ? new Date(since) : new Date(0);
    if (isNaN(sinceDate.getTime())) sinceDate = new Date(0);

    const files = await prisma.file.findMany({
      where: {
        userId:    req.user.id,
        updatedAt: { gt: sinceDate },
      },
      select: {
        id: true, filename: true, size: true, hash: true,
        iv: true, encryptedKey: true, keyIv: true,
        version: true, isDeleted: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
    });

    res.json({
      since:     sinceDate.toISOString(),
      serverTime: new Date().toISOString(),
      changes:   files,
    });
  } catch (err) {
    next(err);
  }
}

// ── Sync Status — server-side summary ─────────────────────
async function status(req, res, next) {
  try {
    const counts = await prisma.file.groupBy({
      by:    ['isDeleted'],
      where: { userId: req.user.id },
      _count: true,
    });

    const active  = counts.find(c => !c.isDeleted)?._count || 0;
    const deleted = counts.find(c =>  c.isDeleted)?._count || 0;
    const latest  = await prisma.file.findFirst({
      where:   { userId: req.user.id, isDeleted: false },
      orderBy: { updatedAt: 'desc' },
      select:  { updatedAt: true },
    });

    res.json({
      totalFiles:    active,
      deletedFiles:  deleted,
      lastModified:  latest?.updatedAt || null,
      serverTime:    new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// ── Activity Log ─────────────────────────────────────────
async function activityLog(req, res, next) {
  try {
    const page  = parseInt(req.query.page  || '1');
    const limit = parseInt(req.query.limit || '50');
    const skip  = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where:   { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { file: { select: { filename: true } } },
      }),
      prisma.activityLog.count({ where: { userId: req.user.id } }),
    ]);

    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

module.exports = { delta, status, activityLog };
