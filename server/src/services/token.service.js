// ============================================================
// Token Service — JWT access + refresh tokens
// ============================================================
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXP     = '15m';
const REFRESH_EXP    = '7d';

function signAccessToken(payload) {
  if (!ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET not set');
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXP });
}

function signRefreshToken(payload) {
  if (!REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET not set');
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXP });
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

function generateTokenPair(user) {
  const payload = { sub: user.id, email: user.email };
  return {
    accessToken:  signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

module.exports = {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
};
