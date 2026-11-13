import { api, ErrorApi } from './api.js';

/*
 * Sesión del usuario: registro, ingreso e invitados.
 * La contraseña se cifra en el navegador con SHA-256 (Web Crypto) y solo se envía esa huella;
 * el backend la vuelve a cifrar con BCrypt. La contraseña nunca se guarda ni se muestra.
 */
const CLAVE = 'ucc3d.sesion';
export const MAX_CLAVE = 30;
export const MIN_CLAVE = 6;

/** SHA-256 en hexadecimal (64 caracteres). */
export async function huella(texto) {
  const datos = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function sesionGuardada() {
  try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; }
}

function guardar(s) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ token: s.token, nombre: s.nombre, correo: s.correo, rol: s.rol })); } catch { /* modo privado */ }
}

export function cerrarSesion() {
  try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
  api.usarToken(null);
}

/**
 * Muestra la pantalla de acceso y resuelve con la sesión cuando el usuario
 * ingresa, se registra o entra como invitado.
 */
export function pedirAcceso() {
  const $ = (s) => document.querySelector(s);
  const raiz = $('#acceso');
  const form = $('#form-acceso');
  const clave = $('#acc-clave');
  const contador = $('#acc-contador');
  const error = $('#acc-error');
  const boton = $('#acc-enviar');
  let modo = 'ingresar';

  const cambiarModo = (m) => {
    modo = m;
    raiz.querySelectorAll('.acc-pestanas button').forEach(b => b.classList.toggle('activo', b.dataset.modo === m));
    $('#acc-campo-nombre').hidden = m !== 'registro';
    $('#acc-nombre').required = m === 'registro';
    $('#acc-campo-confirmar').hidden = m !== 'registro';
    $('#acc-confirmar').required = m === 'registro';
    clave.autocomplete = m === 'registro' ? 'new-password' : 'current-password';
    boton.textContent = m === 'registro' ? 'Crear mi cuenta' : 'Ingresar';
    error.textContent = '';
  };

  return new Promise((resolver) => {
    raiz.hidden = false;
    cambiarModo('ingresar');
    setTimeout(() => $('#acc-correo').focus(), 50);

    const terminar = (s) => {
      guardar(s);
      api.usarToken(s.token);
      form.reset();
      contador.textContent = `0/${MAX_CLAVE}`;
      raiz.hidden = true;
      raiz.onclick = form.onsubmit = clave.oninput = null;
      resolver(s);
    };

    clave.oninput = () => { contador.textContent = `${clave.value.length}/${MAX_CLAVE}`; };

    raiz.onclick = async (ev) => {
      const pestana = ev.target.closest('.acc-pestanas button');
      if (pestana) return cambiarModo(pestana.dataset.modo);
      if (ev.target.closest('#acc-invitado')) {
        error.textContent = '';
        try { terminar(await api.invitado()); }
        catch { error.textContent = 'No se pudo conectar con el servidor. Intenta de nuevo.'; }
      }
    };

    form.onsubmit = async (ev) => {
      ev.preventDefault();
      error.textContent = '';
      const correo = $('#acc-correo').value.trim();
      const texto = clave.value;
      if (texto.length < MIN_CLAVE || texto.length > MAX_CLAVE)
        return (error.textContent = `La contraseña debe tener entre ${MIN_CLAVE} y ${MAX_CLAVE} caracteres.`);
      if (modo === 'registro' && texto !== $('#acc-confirmar').value)
        return (error.textContent = 'Las contraseñas no coinciden.');

      boton.disabled = true;
      try {
        const h = await huella(texto);
        clave.value = ''; $('#acc-confirmar').value = '';     // la contraseña no se queda en la página
        const s = modo === 'registro'
          ? await api.registrar($('#acc-nombre').value.trim(), correo, h)
          : await api.ingresar(correo, h);
        terminar(s);
      } catch (e) {
        error.textContent = e instanceof ErrorApi ? e.message : 'No se pudo conectar con el servidor. Intenta de nuevo.';
        contador.textContent = `0/${MAX_CLAVE}`;
      } finally {
        boton.disabled = false;
      }
    };
  });
}
