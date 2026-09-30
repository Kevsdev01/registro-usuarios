// src/controllers/user.controller.js
// Recibe la petición, valida, llama al modelo y responde JSON.
const bcrypt = require('bcryptjs');
const userModel = require('../models/user.model');
const { validateUser } = require('../validators/user.validator');

// Traduce cada índice UNIQUE de MySQL a un campo del formulario
const DUPLICATE_FIELDS = {
  user_email_UNIQUE: ['email', 'Ya existe un usuario con ese correo.'],
  user_phone_number_UNIQUE: ['phoneNumber', 'Ese teléfono ya está registrado.'],
  user_doty_document_number_UNIQUE: ['documentNumber', 'Ya existe un usuario con ese tipo y número de documento.'],
  acce_username_UNIQUE: ['username', 'Ese nombre de usuario ya está en uso.']
};

// Convierte el :id de la URL en número; null si no es válido
function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Traduce errores conocidos de MySQL a una respuesta HTTP.
// Devuelve true si ya respondió; false si el error no es conocido.
function handleDbError(err, res) {
  if (err.code === 'ER_DUP_ENTRY') {
    const key = Object.keys(DUPLICATE_FIELDS).find((k) => err.message.includes(k));
    if (key) {
      const [field, message] = DUPLICATE_FIELDS[key];
      res.status(409).json({ message, errors: { [field]: message } });
    } else {
      res.status(409).json({ message: 'Uno de los datos ya está registrado.' });
    }
    return true;
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    res.status(400).json({ message: 'Uno de los valores seleccionados no existe.' });
    return true;
  }
  return false;
}

// GET /api/users
async function list(req, res, next) {
  try {
    const users = await userModel.findAll();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id
async function getById(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'El id del usuario no es válido.' });

  try {
    const user = await userModel.findById(id);
    if (!user) return res.status(404).json({ message: 'El usuario no existe.' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// POST /api/users
async function create(req, res, next) {
  const { data, errors } = validateUser(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Revisa los campos marcados.', errors });
  }

  try {
    const passwordHash = await bcrypt.hash(data.password, 10);
        const id = await userModel.create(
      data,
      { username: data.username, passwordHash },
      data.roleIds,
      req.user.sub
    );
    res.status(201).json({
      id,
      message: `Usuario ${data.firstName} ${data.lastName} registrado.`
    });
  } catch (err) {
    if (!handleDbError(err, res)) next(err);
  }
}

// PUT /api/users/:id
async function update(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'El id del usuario no es válido.' });

  // Al editar, la contraseña es opcional
  const { data, errors } = validateUser(req.body, { passwordRequired: false });
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Revisa los campos marcados.', errors });
  }

  try {
    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const found = await userModel.update(
      id,
      data,
      { username: data.username, passwordHash },
      data.roleIds,
      req.user.sub
    );
    if (!found) return res.status(404).json({ message: 'El usuario no existe.' });

    res.json({
      id,
      message: `Usuario ${data.firstName} ${data.lastName} actualizado.`
    });
  } catch (err) {
    if (!handleDbError(err, res)) next(err);
  }
}

// PATCH /api/users/:id/status   body: { "isActive": true | false }
async function changeStatus(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'El id del usuario no es válido.' });

  const isActive = req.body?.isActive;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ message: 'isActive debe ser true o false.' });
  }

  try {
        const found = await userModel.setStatus(id, isActive, req.user.sub);
    if (!found) return res.status(404).json({ message: 'El usuario no existe.' });

    res.json({
      id,
      isActive,
      message: isActive ? 'Usuario activado.' : 'Usuario desactivado.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, changeStatus };