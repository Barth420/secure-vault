// ============================================================
// Express App Entry Point
// ============================================================
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const authRoutes  = require('./routes/auth.routes');
const fileRoutes  = require('./routes/file.routes');
const shareRoutes = require('./routes/share.routes');
const syncRoutes  = require('./routes/sync.routes');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Security Headers ──────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ──────────────────────────────────────────────────
// Allow localhost AND any local network IP (so phones on same Wi-Fi can connect)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow localhost on any port
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
    // Allow any private LAN IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (/^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(origin)) return callback(null, true);
    // Fallback: check CLIENT_ORIGIN env var
    if (origin === process.env.CLIENT_ORIGIN) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ── Request Logging ───────────────────────────────────────
app.use(morgan('dev'));

// ── Body Parsing ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Global Rate Limiter ───────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

// ── Auth Rate Limiter (stricter) ──────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',  authLimiter, authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/sync',  syncRoutes);

// ── Health Check ──────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── 404 Handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message || err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔐 Secure Cloud Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
