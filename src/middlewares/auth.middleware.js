// src/middlewares/auth.middleware.js
// Verifica el token JWT y los permisos del usuario autenticado.
const jwt = require('jsonwebtoken');

// Exige un token válido y adjunta su contenido en req.user
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Debes iniciar sesión.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { sub, username, roles, permissions, iat, exp }
    next();
  } catch {
    return res.status(401).json({ message: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });
  }
}

// Exige que el usuario autenticado tenga un permiso concreto
function authorize(permission) {
  return (req, res, next) => {
    if (!req.user?.permissions?.includes(permission)) {
      return res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };