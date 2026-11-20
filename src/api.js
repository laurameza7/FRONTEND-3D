// Client for the Java backend API.
// The URL is set with the VITE_API_URL environment variable (on Vercel).
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

let token = null;
let onExpire = null;

/** Error with the HTTP status and the message returned by the backend. */
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(BASE + path, { ...options, headers: headers });
  if (!r.ok) {
    let message = `Error ${r.status}`;
    try { const j = await r.json(); message = j.error || j.message || j.detail || message; } catch { /* no body */ }
    if (r.status === 401 && token && !path.startsWith('/api/auth/')) onExpire?.();
    throw new ApiError(r.status, message);
  }
  return r.json();
}

const send = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const api = {
  useToken: (t) => { token = t; },
  onSessionExpired: (f) => { onExpire = f; },

  // Campus (public)
  health: () => request('/api/health'),
  buildings: () => request('/api/buildings'),
  places: () => request('/api/places'),
  programs: () => request('/api/programs'),
  program: (id) => request('/api/programs/' + id),

  // Users: the password never travels; only its SHA-256 fingerprint computed in the browser
  register: (name, email, fingerprint) => send('/api/auth/register', { name, email, fingerprint }),
  login: (email, fingerprint) => send('/api/auth/login', { email, fingerprint }),
  guest: () => send('/api/auth/guest'),

  // Coopi (session required)
  greeting: () => request('/api/assistant/greeting'),
  history: () => request('/api/assistant/history'),
  ask: (question, programId = null) => send('/api/assistant/ask', { question, programId }),
};
