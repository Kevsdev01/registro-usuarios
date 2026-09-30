// src/controllers/auth.controller.js
// Recibe usuario y contraseña, verifica credenciales y devuelve un token JWT.
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authModel = require('../models/auth.model');
const { validateLogin } = require('../validators/auth.validator');


const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// POST /api/auth/login
async function login(req, res, next) {
  const { data, errors } = validateLogin(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Revisa los campos marcados.', errors });
  }

  try {
    const access = await authModel.findAuthByUsername(data.username);

    // Mismo mensaje si el usuario no existe o si la contraseña falla: no revelamos cuál de las dos falló
    if (!access) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    }

    if (access.lockedUntil && new Date(access.lockedUntil) > new Date()) {
      const minutes = Math.ceil((new Date(access.lockedUntil) - new Date()) / 60000);
      return res.status(423).json({ message: `Cuenta bloqueada. Intenta de nuevo en ${minutes} minuto(s).` });
    }

    if (!access.accessIsActive || !access.userIsActive) {
      return res.status(403).json({ message: 'El usuario está desactivado.' });
    }

    const passwordOk = await bcrypt.compare(data.password, access.passwordHash);
    if (!passwordOk) {
      const failedAttempts = access.failedAttempts + 1;
      const lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60000)
        : null;

      await authModel.registerFailedAttempt(access.accessId, failedAttempts, lockedUntil);

      if (lockedUntil) {
        return res.status(423).json({ message: `Demasiados intentos. Cuenta bloqueada ${LOCK_MINUTES} minutos.` });
      }
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    }

    await authModel.registerSuccessfulLogin(access.accessId);
    const { roles, permissions } = await authModel.getRolesAndPermissions(access.userId);

    const token = jwt.sign(
      { sub: access.userId, username: access.username, roles, permissions },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );


    res.json({
      token,
      user: {
        id: access.userId,
        username: access.username,
        firstName: access.firstName,
        lastName: access.lastName,
        roles,
        permissions
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login };