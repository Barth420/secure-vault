// ============================================================
// Auth Controller — Register, Login, Refresh, Me
// ============================================================
const argon2  = require('argon2');
const crypto  = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { generateTokenPair, verifyRefreshToken } = require('../services/token.service');

const prisma = new PrismaClient();

// ── Register ─────────────────────────────────────────────
async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    // Hash password with Argon2id (memory-hard, resist GPU attacks)
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,   // 64MB
      timeCost: 3,
      parallelism: 4,
    });

    // Generate salt for client-side PBKDF2 key derivation
    // This salt is public — it is NOT the password hash salt
    const salt = crypto.randomBytes(32).toString('base64');

    const user = await prisma.user.create({
      data: { email, passwordHash, salt },
      select: { id: true, email: true, salt: true, createdAt: true },
    });

    const tokens = generateTokenPair(user);

    // Log registration
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'REGISTER',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(201).json({ user, ...tokens });
  } catch (err) {
    next(err);
  }
}

// ── Login ─────────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const tokens = generateTokenPair(user);

    // Return salt so client can re-derive master key
    const safeUser = { id: user.id, email: user.email, salt: user.salt, createdAt: user.createdAt };

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ user: safeUser, ...tokens });
  } catch (err) {
    next(err);
  }
}

// ── Refresh Token ─────────────────────────────────────────
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const payload = verifyRefreshToken(refreshToken);
    const user    = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, salt: true },
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    const tokens = generateTokenPair(user);
    res.json(tokens);
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Refresh token expired, please log in again' });
    next(err);
  }
}

// ── Me (get current user) ─────────────────────────────────
async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, salt: true, createdAt: true, updatedAt: true },
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, me };
