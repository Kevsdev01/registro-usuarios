// src/routes/catalog.routes.js
const { Router } = require('express');
const catalogController = require('../controllers/catalog.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authenticate);

router.get('/', catalogController.getAll);   // GET /api/catalogs

module.exports = router;