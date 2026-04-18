const router = require('express').Router();
const { upload, download, list, remove, versions, restoreVersion } = require('../controllers/file.controller');
const { authenticate }  = require('../middlewares/auth.middleware');
const { upload: multer } = require('../middlewares/upload.middleware');

router.use(authenticate);

router.post('/upload',                  multer.single('file'), upload);
router.get('/download/:id',             download);
router.get('/list',                     list);
router.delete('/:id',                   remove);
router.get('/:id/versions',             versions);
router.post('/:id/versions/:versionId/restore', restoreVersion);

module.exports = router;
