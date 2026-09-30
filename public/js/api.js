// public/js/api.js
// Todas las peticiones HTTP al backend. Ningún otro archivo usa fetch.

// Error con el código HTTP y los errores por campo que envía el servidor
export class ApiError extends Error {
  constructor(message, status, errors = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

// Función base: hace la petición, lee el JSON y lanza ApiError si falla

const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUser';

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
      },
      ...options
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor. Verifica que esté en ejecución.', 0);
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(body.message || `Error ${response.status}`, response.status, body.errors);
  }
  return body;
}

export function getCatalogs() {
  return request('/api/catalogs');
}

export function getUsers() {
  return request('/api/users');
}

export function createUser(user) {
  return request('/api/users', {
    method: 'POST',
    body: JSON.stringify(user)
  });
}

export function login(credentials) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
}

export function getUser(id) {
  return request(`/api/users/${id}`);
}

export function updateUser(id, user) {
  return request(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(user)
  });
}

export function setUserStatus(id, isActive) {
  return request(`/api/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive })
  });
}
