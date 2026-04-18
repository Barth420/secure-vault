// ============================================================
// Upload Middleware — Multer config with chunked upload support
// ============================================================
const multer  = require('multer');
const path    = require('path');
const os      = require('os');

// Store uploads in OS temp dir, then storage service moves them
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB default
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types (encryption makes type less relevant)
    cb(null, true);
  },
});

module.exports = { upload };
