// Cliente de la API del backend en Java.
// La URL se configura con la variable de entorno VITE_API_URL (en Vercel).
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

async function pedir(ruta, opciones = {}) {
  const r = await fetch(BASE + ruta, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  if (!r.ok) throw new Error(`Error ${r.status} en ${ruta}`);
  return r.json();
}

export const api = {
  salud: () => pedir('/api/salud'),
  edificios: () => pedir('/api/edificios'),
  lugares: () => pedir('/api/lugares'),
  programas: () => pedir('/api/programas'),
  preguntar: (pregunta) =>
    pedir('/api/asistente/preguntar', { method: 'POST', body: JSON.stringify({ pregunta }) }),
};
