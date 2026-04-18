const router = require('express').Router();
const { register, login, refresh, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.post('/register', register);
router.post('/login',    login);
router.post('/refresh',  refresh);
router.get('/me',        authenticate, me);

module.exports = router;
