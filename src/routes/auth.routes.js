// src/routes/auth.routes.js
const { Router } = require('express');
const authController = require('../controllers/auth.controller');

const router = Router();

router.post('/login', authController.login);   // POST /api/auth/login

module.exports = router;