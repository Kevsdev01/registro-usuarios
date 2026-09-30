// public/js/login.js
// Controla la pantalla de login: envía credenciales y guarda la sesión.
import { login, saveSession, getToken } from './api.js';

const form = document.getElementById('loginForm');
const formMessage = document.getElementById('formMessage');
const submitBtn = document.getElementById('submitBtn');
const togglePassword = document.getElementById('togglePassword');

function setMessage(text, type = '') {
  formMessage.textContent = text;
  formMessage.className = `form-message ${type}`;
}

// Si ya hay una sesión guardada, no tiene sentido mostrar el login otra vez
if (getToken()) {
  window.location.href = 'index.html';
}

togglePassword.addEventListener('click', () => {
  const input = form.elements.password;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  togglePassword.textContent = show ? 'Ocultar' : 'Mostrar';
  togglePassword.setAttribute('aria-pressed', String(show));
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');

  const credentials = Object.fromEntries(new FormData(form));

  submitBtn.disabled = true;
  submitBtn.textContent = 'Ingresando…';

  try {
    const result = await login(credentials);
    saveSession(result.token, result.user);
    window.location.href = 'index.html';
  } catch (err) {
    setMessage(err.message, 'bad');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Ingresar';
  }
});