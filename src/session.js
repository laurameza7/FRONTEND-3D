import { api, ApiError } from './api.js';

/*
 * User session: registration, login and guests.
 * The password is hashed in the browser with SHA-256 (Web Crypto) and only that fingerprint is sent;
 * the backend hashes it again with BCrypt. The password is never stored nor shown.
 */
const STORAGE_KEY = 'ucc3d.session';
export const MAX_PASSWORD = 30;
export const MIN_PASSWORD = 6;

/** SHA-256 in hexadecimal (64 characters). */
export async function fingerprint(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function savedSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

function save(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: s.token, name: s.name, email: s.email, role: s.role })); } catch { /* private mode */ }
}

export function logout() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* nothing */ }
  api.useToken(null);
}

/**
 * Shows the access screen and resolves with the session when the user
 * logs in, registers or enters as a guest.
 */
export function requestAccess() {
  const $ = (s) => document.querySelector(s);
  const root = $('#access');
  const form = $('#access-form');
  const password = $('#acc-password');
  const counter = $('#acc-counter');
  const error = $('#acc-error');
  const button = $('#acc-submit');
  let mode = 'login';

  const changeMode = (m) => {
    mode = m;
    root.querySelectorAll('.acc-tabs button').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    $('#acc-name-field').hidden = m !== 'register';
    $('#acc-name').required = m === 'register';
    $('#acc-confirm-field').hidden = m !== 'register';
    $('#acc-confirm').required = m === 'register';
    password.autocomplete = m === 'register' ? 'new-password' : 'current-password';
    button.textContent = m === 'register' ? 'Crear mi cuenta' : 'Ingresar';
    error.textContent = '';
  };

  return new Promise((resolve) => {
    root.hidden = false;
    changeMode('login');
    setTimeout(() => $('#acc-email').focus(), 50);

    const finish = (s) => {
      save(s);
      api.useToken(s.token);
      form.reset();
      counter.textContent = `0/${MAX_PASSWORD}`;
      root.hidden = true;
      root.onclick = form.onsubmit = password.oninput = null;
      resolve(s);
    };

    password.oninput = () => { counter.textContent = `${password.value.length}/${MAX_PASSWORD}`; };

    root.onclick = async (ev) => {
      const tab = ev.target.closest('.acc-tabs button');
      if (tab) return changeMode(tab.dataset.mode);
      if (ev.target.closest('#acc-guest')) {
        error.textContent = '';
        try { finish(await api.guest()); }
        catch { error.textContent = 'No se pudo conectar con el servidor. Intenta de nuevo.'; }
      }
    };

    form.onsubmit = async (ev) => {
      ev.preventDefault();
      error.textContent = '';
      const email = $('#acc-email').value.trim();
      const text = password.value;
      if (text.length < MIN_PASSWORD || text.length > MAX_PASSWORD)
        return (error.textContent = `La contraseña debe tener entre ${MIN_PASSWORD} y ${MAX_PASSWORD} caracteres.`);
      if (mode === 'register' && text !== $('#acc-confirm').value)
        return (error.textContent = 'Las contraseñas no coinciden.');

      button.disabled = true;
      try {
        const h = await fingerprint(text);
        password.value = ''; $('#acc-confirm').value = '';     // the password does not stay on the page
        const s = mode === 'register'
          ? await api.register($('#acc-name').value.trim(), email, h)
          : await api.login(email, h);
        finish(s);
      } catch (e) {
        error.textContent = e instanceof ApiError ? e.message : 'No se pudo conectar con el servidor. Intenta de nuevo.';
        counter.textContent = `0/${MAX_PASSWORD}`;
      } finally {
        button.disabled = false;
      }
    };
  });
}
