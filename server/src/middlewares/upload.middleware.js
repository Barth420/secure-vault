// ============================================================
// Upload Middleware — Multer config with disk storage
// Uses disk storage so large files (multi-GB) stream directly
// to a temp folder instead of being loaded into RAM.
// ============================================================
const multer = require('multer');
const path   = require('path');
const os     = require('os');
const fs     = require('fs');

// Use a dedicated temp folder inside the container
const TEMP_DIR = path.join(os.tmpdir(), 'securevault-uploads');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// Stream directly to disk — critical for large files
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_DIR),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}`),
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10737418240'), // 10GB default
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types (encryption makes type less relevant)
    cb(null, true);
  },
});

module.exports = { upload, TEMP_DIR };
