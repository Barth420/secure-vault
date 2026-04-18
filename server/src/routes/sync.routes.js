const router = require('express').Router();
const { delta, status, activityLog } = require('../controllers/sync.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

router.post('/delta',    delta);
router.get('/status',    status);
router.get('/activity',  activityLog);

module.exports = router;
