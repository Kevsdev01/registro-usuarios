// src/routes/user.routes.js
const { Router } = require('express');
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authenticate); // todas las rutas de usuarios exigen sesión

router.get('/', authorize('USERS_READ'), userController.list);
router.get('/:id', authorize('USERS_READ'), userController.getById);
router.post('/', authorize('USERS_CREATE'), userController.create);
router.put('/:id', authorize('USERS_UPDATE'), userController.update);
router.patch('/:id/status', authorize('USERS_UPDATE'), userController.changeStatus);

module.exports = router;