// src/models/auth.model.js
// Acceso a datos para autenticación: buscar credenciales, registrar intentos y consultar permisos.
const { pool } = require('../config/database');

// Trae el acceso de un username junto con el estado del usuario dueño
async function findAuthByUsername(username) {
  const [rows] = await pool.query(
    `SELECT a.acce_id              AS accessId,
            a.acce_user_id         AS userId,
            a.acce_username        AS username,
            a.acce_password_hash   AS passwordHash,
            a.acce_is_active       AS accessIsActive,
            a.acce_failed_attempts AS failedAttempts,
            a.acce_locked_until    AS lockedUntil,
            u.user_is_active       AS userIsActive,
            u.user_first_name      AS firstName,
            u.user_last_name       AS lastName
       FROM accesses a
       JOIN users u ON u.user_id = a.acce_user_id
      WHERE a.acce_username = ?`,
    [username]
  );
  return rows[0] || null;
}

// Suma un intento fallido y, opcionalmente, fija hasta cuándo queda bloqueado
async function registerFailedAttempt(accessId, failedAttempts, lockedUntil) {
  await pool.execute(
    'UPDATE accesses SET acce_failed_attempts = ?, acce_locked_until = ? WHERE acce_id = ?',
    [failedAttempts, lockedUntil, accessId]
  );
}

// Login correcto: reinicia el contador, quita el bloqueo y marca la fecha de acceso
async function registerSuccessfulLogin(accessId) {
  await pool.execute(
    `UPDATE accesses
        SET acce_failed_attempts = 0, acce_locked_until = NULL,
            acce_last_login_at = CURRENT_TIMESTAMP(6)
      WHERE acce_id = ?`,
    [accessId]
  );
}

// Códigos de rol y de permiso del usuario, para meterlos en el token
async function getRolesAndPermissions(userId) {
  const [roles] = await pool.query(
    `SELECT DISTINCT r.role_code AS code
       FROM users_roles ur
       JOIN roles r ON r.role_id = ur.role_id
      WHERE ur.user_id = ?`,
    [userId]
  );

  const [permissions] = await pool.query(
    `SELECT DISTINCT p.perm_code AS code
       FROM users_roles ur
       JOIN roles_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p        ON p.perm_id = rp.perm_id
      WHERE ur.user_id = ?`,
    [userId]
  );

  return {
    roles: roles.map((r) => r.code),
    permissions: permissions.map((p) => p.code)
  };
}

module.exports = { findAuthByUsername, registerFailedAttempt, registerSuccessfulLogin, getRolesAndPermissions };