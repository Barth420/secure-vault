// ============================================================
// Auth Middleware — Verify JWT access token on protected routes
// ============================================================
const { verifyAccessToken } = require('../services/token.service');
const { PrismaClient }      = require('@prisma/client');

const prisma = new PrismaClient();

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);

    // Confirm user still exists (prevents using tokens for deleted users)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authenticate };
