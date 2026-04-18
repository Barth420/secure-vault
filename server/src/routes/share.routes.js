const router = require('express').Router();
const { createShare, accessShare, downloadShare, listShares, revokeShare } = require('../controllers/share.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Public routes (no auth needed — share recipient)
router.post('/:token/access',   accessShare);
router.get('/:token/download',  downloadShare);

// Protected routes (share owner)
router.use(authenticate);
router.post('/create',  createShare);
router.get('/list',     listShares);
router.delete('/:token', revokeShare);

module.exports = router;
