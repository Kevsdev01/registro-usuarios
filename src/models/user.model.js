// src/models/user.model.js
// Acceso a datos de usuarios: consultas y transacción de registro.
const { pool } = require('../config/database');

// Lista de usuarios con tipo de documento, username y roles
async function findAll() {
  const [rows] = await pool.query(`
    SELECT u.user_id              AS id,
           u.user_first_name      AS firstName,
           u.user_last_name       AS lastName,
           dt.doty_code           AS documentType,
           u.user_document_number AS documentNumber,
           u.user_email           AS email,
           u.user_phone_number    AS phoneNumber,
           a.acce_username        AS username,
           u.user_is_active       AS isActive,
           u.user_created_at      AS createdAt,
           GROUP_CONCAT(r.role_name ORDER BY r.role_name SEPARATOR ', ') AS roles
      FROM users u
      JOIN document_types dt   ON dt.doty_id    = u.user_document_type_id
      LEFT JOIN accesses a     ON a.acce_user_id = u.user_id
      LEFT JOIN users_roles ur ON ur.user_id    = u.user_id
      LEFT JOIN roles r        ON r.role_id     = ur.role_id
     GROUP BY u.user_id, a.acce_username
     ORDER BY u.user_created_at DESC`);
  return rows;
}

/**
 * Crea el usuario, su acceso y sus roles en UNA transacción.
 * Si cualquier INSERT falla, se deshace todo (rollback).
 * @param {object}   user    datos personales ya validados
 * @param {object}   access  { username, passwordHash }
 * @param {number[]} roleIds ids de los roles
 * @returns {Promise<number>} id del usuario creado
 */

async function create(user, access, roleIds, createdBy) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. users
        const [userResult] = await conn.execute(
      `INSERT INTO users
         (user_first_name, user_last_name, user_document_type_id, user_document_number,
          user_email, user_phone_number, user_sex_id, user_gender_id, user_created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.firstName,
        user.lastName,
        user.documentTypeId,
        user.documentNumber,
        user.email,
        user.phoneNumber,
        user.sexId,
        user.genderId,
        createdBy
      ]
    );
    const userId = userResult.insertId;

    // 2. accesses
        await conn.execute(
      `INSERT INTO accesses
         (acce_user_id, acce_username, acce_password_hash, acce_password_changed_at, acce_created_by)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP(6), ?)`,
      [userId, access.username, access.passwordHash, createdBy]
    );

    // 3. users_roles: varias filas en un solo INSERT
            const roleRows = roleIds.map((roleId) => [userId, roleId, createdBy]);
    await conn.query('INSERT INTO users_roles (user_id, role_id, usro_created_by) VALUES ?', [roleRows]);

    await conn.commit();
    return userId;
  } catch (err) {
    await conn.rollback();
    throw err;            // el controlador decide qué responder
  } finally {
    conn.release();       // siempre devolver la conexión al pool
  }
}



  // Un usuario completo (ids de catálogos y de roles) para llenar el formulario de edición
async function findById(id) {
  const [rows] = await pool.query(`
    SELECT u.user_id              AS id,
           u.user_first_name      AS firstName,
           u.user_last_name       AS lastName,
           u.user_document_type_id AS documentTypeId,
           u.user_document_number AS documentNumber,
           u.user_email           AS email,
           u.user_phone_number    AS phoneNumber,
           u.user_sex_id          AS sexId,
           u.user_gender_id       AS genderId,
           u.user_is_active       AS isActive,
           a.acce_username        AS username
      FROM users u
      LEFT JOIN accesses a ON a.acce_user_id = u.user_id
     WHERE u.user_id = ?`, [id]);

  if (rows.length === 0) return null;

  const [roles] = await pool.query(
    'SELECT role_id AS id FROM users_roles WHERE user_id = ?', [id]
  );
  return { ...rows[0], roleIds: roles.map((r) => r.id) };
}

/**
 * Actualiza usuario, acceso y roles en UNA transacción.
 * @returns {Promise<boolean>} false si el usuario no existe
 */

async function update(id, user, access, roleIds, updatedBy) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 0. ¿Existe? FOR UPDATE bloquea la fila mientras dura la transacción
    const [found] = await conn.execute(
      'SELECT user_id FROM users WHERE user_id = ? FOR UPDATE', [id]
    );
    if (found.length === 0) {
      await conn.rollback();
      return false;
    }

    // 1. users
        await conn.execute(
      `UPDATE users
          SET user_first_name = ?, user_last_name = ?, user_document_type_id = ?,
              user_document_number = ?, user_email = ?, user_phone_number = ?,
              user_sex_id = ?, user_gender_id = ?, user_updated_by = ?
        WHERE user_id = ?`,
      [
        user.firstName,
        user.lastName,
        user.documentTypeId,
        user.documentNumber,
        user.email,
        user.phoneNumber,
        user.sexId,
        user.genderId,
        updatedBy,
        id
      ]
    );

    // 2. accesses: la contraseña solo se cambia si llegó una nueva
       if (access.passwordHash) {
      await conn.execute(
        `UPDATE accesses
            SET acce_username = ?, acce_password_hash = ?,
                acce_password_changed_at = CURRENT_TIMESTAMP(6), acce_updated_by = ?
          WHERE acce_user_id = ?`,
        [access.username, access.passwordHash, updatedBy, id]
      );
    } else {
      await conn.execute(
        'UPDATE accesses SET acce_username = ?, acce_updated_by = ? WHERE acce_user_id = ?',
        [access.username, updatedBy, id]
      );
    }

    // 3. users_roles: se borran los roles actuales y se insertan los nuevos
    await conn.execute('DELETE FROM users_roles WHERE user_id = ?', [id]);
        const roleRows = roleIds.map((roleId) => [id, roleId, updatedBy]);
    await conn.query('INSERT INTO users_roles (user_id, role_id, usro_created_by) VALUES ?', [roleRows]);

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Activa o desactiva al usuario Y a su acceso, en una transacción.
 * @returns {Promise<boolean>} false si el usuario no existe
 */
async function setStatus(id, isActive, updatedBy) {
  const conn = await pool.getConnection();
  const value = isActive ? 1 : 0;

  try {
    await conn.beginTransaction();

    const [found] = await conn.execute(
      'SELECT user_id FROM users WHERE user_id = ? FOR UPDATE', [id]
    );
    if (found.length === 0) {
      await conn.rollback();
      return false;
    }

        await conn.execute('UPDATE users SET user_is_active = ?, user_updated_by = ? WHERE user_id = ?', [value, updatedBy, id]);
    await conn.execute('UPDATE accesses SET acce_is_active = ?, acce_updated_by = ? WHERE acce_user_id = ?', [value, updatedBy, id]);

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { findAll, findById, create, update, setStatus };
