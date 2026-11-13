// Cliente de la API del backend en Java.
// La URL se configura con la variable de entorno VITE_API_URL (en Vercel).
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

let token = null;
let alExpirar = null;

/** Error con el código HTTP y el mensaje que devolvió el backend. */
export class ErrorApi extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}

async function pedir(ruta, opciones = {}) {
  const cabeceras = { 'Content-Type': 'application/json' };
  if (token) cabeceras.Authorization = 'Bearer ' + token;
  const r = await fetch(BASE + ruta, { ...opciones, headers: cabeceras });
  if (!r.ok) {
    let mensaje = `Error ${r.status}`;
    try { const j = await r.json(); mensaje = j.error || j.message || j.detail || mensaje; } catch { /* sin cuerpo */ }
    if (r.status === 401 && token && !ruta.startsWith('/api/auth/')) alExpirar?.();
    throw new ErrorApi(r.status, mensaje);
  }
  return r.json();
}

const enviar = (ruta, cuerpo) => pedir(ruta, { method: 'POST', body: JSON.stringify(cuerpo ?? {}) });

export const api = {
  usarToken: (t) => { token = t; },
  alExpirarSesion: (f) => { alExpirar = f; },

  // Campus (públicas)
  salud: () => pedir('/api/salud'),
  edificios: () => pedir('/api/edificios'),
  lugares: () => pedir('/api/lugares'),
  programas: () => pedir('/api/programas'),
  programa: (id) => pedir('/api/programas/' + id),

  // Usuarios: la contraseña nunca viaja; solo su huella SHA-256 calculada en el navegador
  registrar: (nombre, correo, huella) => enviar('/api/auth/registro', { nombre, correo, huella }),
  ingresar: (correo, huella) => enviar('/api/auth/ingresar', { correo, huella }),
  invitado: () => enviar('/api/auth/invitado'),

  // Coopi (requieren sesión)
  saludo: () => pedir('/api/asistente/saludo'),
  historial: () => pedir('/api/asistente/historial'),
  preguntar: (pregunta, programaId = null) => enviar('/api/asistente/preguntar', { pregunta, programaId }),
};
