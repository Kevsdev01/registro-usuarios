// src/validators/auth.validator.js
// Valida el cuerpo de la petición de login. No valida contra la base de datos.
function validateLogin(body = {}) {
  const errors = {};
  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (!username) errors.username = 'El usuario es obligatorio.';
  if (!password) errors.password = 'La contraseña es obligatoria.';

  return { data: { username, password }, errors };
}

module.exports = { validateLogin };