import './estilos.css';
import { api } from './api.js';
import { Campus3D } from './campus3d.js';
import { Recorrido, tieneInterior, destinoDeLugar, destinoEnTexto } from './recorrido.js';
import { pedirAcceso, sesionGuardada, cerrarSesion } from './sesion.js';
import { Voz } from './voz.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const datos = { edificios: [], lugares: [], programas: [] };
let sesion = null;
let programaActual = null;     // programa del que se está hablando con Coopi

const campus = new Campus3D($('#escena'), { alSeleccionar: mostrarEdificio });
const recorrido = new Recorrido({ alSalir: () => campus.pausar(false) });
window.ucc3d = { campus, recorrido };   // acceso para depurar desde la consola

/* ================================================================== Pantalla de carga */
const carga = {
  progreso(porcentaje, texto) {
    $('#carga-progreso').style.width = porcentaje + '%';
    if (texto) $('#carga-texto').textContent = texto;
  },
  terminar() {
    this.progreso(100, '¡Listo!');
    setTimeout(() => $('#carga').classList.add('oculta'), 350);
    setTimeout(() => { $('#carga').hidden = true; }, 900);
  },
};

function estado(tipo, texto) {
  const el = $('#estado');
  el.className = 'estado ' + tipo;
  el.querySelector('.texto').textContent = texto;
}

async function cargarDatos() {
  $('#carga-reintentar').hidden = true;
  carga.progreso(15, 'Cargando el mapa del campus, espere un momento');
  estado('', 'Conectando con el servidor…');
  carga.progreso(30, 'Conectando con el servidor');
  // El plan gratuito de Render "duerme" el backend; puede tardar ~1 minuto en despertar.
  let avance = 30;
  const aviso = setTimeout(() => {
    $('#carga-aviso').hidden = false;
    carga.progreso(avance, 'Cargando el mapa del campus, espere un momento');
    estado('', 'Despertando el servidor (puede tardar un minuto)…');
  }, 4000);
  for (let intento = 1; intento <= 20; intento++) {
    try {
      const [edificios, lugares, programas] = await Promise.all([api.edificios(), api.lugares(), api.programas()]);
      clearTimeout(aviso);
      $('#carga-aviso').hidden = true;
      carga.progreso(88, 'Construyendo el campus en 3D');
      await new Promise(r => setTimeout(r, 30));       // deja pintar el mensaje
      Object.assign(datos, { edificios, lugares, programas });
      campus.cargar(edificios, lugares);
      const bloques = edificios.filter(e => e.tipo === 'EDIFICIO').length;
      estado('ok', `En línea · ${bloques} bloques · ${programas.length} programas`);
      return true;
    } catch {
      avance = Math.min(82, avance + 3);
      carga.progreso(avance);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  clearTimeout(aviso);
  estado('error', 'No se pudo conectar con el servidor');
  carga.progreso(100, 'No se pudo conectar con el servidor');
  $('#carga-aviso').hidden = true;
  $('#carga-reintentar').hidden = false;
  return false;
}

/* ================================================================== Sesión */
async function iniciarSesion() {
  const guardada = sesionGuardada();
  if (guardada?.token) {
    api.usarToken(guardada.token);
    try {
      const { respuesta } = await api.saludo();     // valida que el token siga vigente
      sesion = guardada;
      return respuesta;
    } catch { cerrarSesion(); }
  }
  sesion = await pedirAcceso();
  return (await api.saludo()).respuesta;
}

function mostrarUsuario() {
  $('#usuario').hidden = !sesion;
  $('#usuario-nombre').textContent = sesion ? (sesion.rol === 'INVITADO' ? '👤 Invitado' : '👤 ' + sesion.nombre.split(' ')[0]) : '';
}

async function saludar(texto) {
  abrirChat();
  const acciones = sesion && sesion.rol !== 'INVITADO'
    ? [{ texto: '🕘 Ver mis conversaciones anteriores', fn: verHistorial }] : [];
  agregarMensaje(texto, 'bot', { acciones });
  voz.hablar(texto);
  ponerSugerencias(SUGERENCIAS);
}

let renovando = false;
api.alExpirarSesion(async () => {
  if (renovando) return;
  renovando = true;
  cerrarSesion();
  agregarMensaje('Tu sesión terminó. Vuelve a ingresar para seguir hablando conmigo.', 'bot');
  sesion = await pedirAcceso();
  mostrarUsuario();
  renovando = false;
  saludar((await api.saludo()).respuesta);
});

$('#btn-salir').addEventListener('click', async () => {
  voz.palabraClave(false);
  voz.callar();
  cerrarSesion();
  sesion = null;
  mostrarUsuario();
  quitarPrograma();
  $('#mensajes').innerHTML = '';
  sesion = await pedirAcceso();
  mostrarUsuario();
  saludar((await api.saludo()).respuesta);
});

async function verHistorial() {
  try {
    const h = await api.historial();
    if (!h.length) return agregarMensaje('Aún no tienes conversaciones guardadas conmigo.', 'bot');
    agregarMensaje('Estas son tus últimas preguntas:\n' + h.slice(-8).map(m => `• ${m.pregunta}  (${m.fecha})`).join('\n'), 'bot');
  } catch {
    agregarMensaje('No pude traer tu historial en este momento.', 'bot');
  }
}

/* ================================================================== Navegación */
/** Entra caminando a un bloque (opcionalmente a un piso y lugar concretos). */
function entrar(codigo, nivel, destino, { conChat = false } = {}) {
  campus.pausar(true);
  if (conChat) abrirChat();
  else $('#chat').classList.add('cerrado');   // el chat queda minimizado para no tapar la vista
  $('#panel').hidden = true;
  if (recorrido.abierto && recorrido.codigo === codigo) recorrido.irA(nivel, destino);
  else {
    if (recorrido.abierto) recorrido.cerrar();
    campus.pausar(true);
    recorrido.abrir(codigo, nivel, destino);
  }
}

function salirDelRecorrido() {
  if (recorrido.abierto) recorrido.cerrar();
}

/** Lleva a un lugar: si tiene interior entra caminando; si no, lo muestra en el mapa. */
function irALugar(lugar, opciones) {
  if (!lugar) return false;
  const e = datos.edificios.find(x => x.id === lugar.edificioId);
  const d = e && destinoDeLugar(e.codigo, lugar.nombre);
  if (d) { entrar(e.codigo, d.nivel, d.destino, opciones); return true; }
  if (e) { salirDelRecorrido(); mostrarEdificio(e.id); }
  return false;
}

/* ================================================================== Panel del bloque */
function mostrarEdificio(id) {
  const e = datos.edificios.find(x => x.id === id);
  if (!e) return;
  campus.seleccionar(id);
  const lugares = datos.lugares.filter(l => l.edificioId === id);
  const programas = datos.programas.filter(p => p.edificioId === id);

  const chips = e.tipo === 'EDIFICIO'
    ? `<span class="etiqueta" style="background:${esc(e.color)}">${e.pisos} pisos</span>
       ${e.sotanos ? `<span class="etiqueta" style="background:#4f6d8f">${e.sotanos} sótanos</span>` : ''}`
    : `<span class="etiqueta" style="background:#7b8a97">${e.tipo === 'ACCESO' ? 'Entrada' : 'Zona abierta'}</span>`;

  // Pisos de arriba hacia abajo, incluidos los sótanos
  let pisosHtml = '';
  if (e.tipo === 'EDIFICIO') {
    const niveles = [];
    for (let p = e.pisos; p >= 1; p--) niveles.push(p);
    for (let s = 1; s <= (e.sotanos || 0); s++) niveles.push(-s);
    const etiquetaNivel = (p) => p > 0 ? 'Piso ' + p : (e.codigo === 'B' && p === -1 ? 'Piso 0 · Sót. 1' : 'Sótano ' + -p);
    pisosHtml = `<h3>Piso por piso</h3><div class="pisos">${niveles.map(p => {
      const aqui = lugares.filter(l => l.piso === p || (l.nombre === 'Biblioteca' && p === 3 && l.piso === 2));
      return `<div class="piso ${p < 0 ? 'sotano' : ''}"><b>${etiquetaNivel(p)}</b>
        <div class="contenido ${aqui.length ? '' : 'vacio'}">${aqui.length
          ? aqui.map(l => {
              const d = destinoDeLugar(e.codigo, l.nombre);
              return `<div>${d ? `<button class="lugar-ir" type="button" data-codigo="${e.codigo}" data-nivel="${d.nivel}" data-destino="${d.destino}">🚶 Ir</button>` : ''}<strong>${esc(l.nombre)}</strong>${l.telefono ? `<span>☎ ${esc(l.telefono)}</span>` : ''}</div>`;
            }).join('')
          : 'Sin información registrada'}</div></div>`;
    }).join('')}</div>`;
  } else if (lugares.length) {
    pisosHtml = `<h3>Qué encuentras aquí</h3>${lugares.map(l => `
      <div class="lugar"><strong>${esc(l.nombre)}</strong>${l.descripcion ? `<span>${esc(l.descripcion)}</span>` : ''}
        ${l.telefono ? `<span>☎ ${esc(l.telefono)}</span>` : ''}</div>`).join('')}`;
  }

  $('#panel-contenido').innerHTML = `
    <div class="chips">${chips}</div>
    <h2>${esc(e.nombre)}</h2>
    <p>${esc(e.descripcion)}</p>
    ${tieneInterior(e.codigo) ? `<button class="btn-entrar" type="button" data-codigo="${e.codigo}">🚶 Entrar y recorrer el ${esc(e.nombre)} por dentro</button>` : ''}
    ${pisosHtml}
    ${programas.length ? `<h3>Programas con práctica aquí</h3>${programas.map(p => `
      <div class="lugar" data-programa="${p.id}" style="cursor:pointer"><strong>${esc(p.nombre)}</strong><span>${esc(p.titulo)}</span></div>`).join('')}` : ''}
  `;
  $('#panel').hidden = false;
}

$('#panel-contenido').addEventListener('click', (ev) => {
  const prog = ev.target.closest('[data-programa]');
  if (prog) return mostrarPrograma(datos.programas.find(p => p.id === Number(prog.dataset.programa)));
  const acc = ev.target.closest('[data-accion]');
  if (acc) return accionesPrograma[acc.dataset.accion]?.();
  const b = ev.target.closest('.btn-entrar, .lugar-ir');
  if (!b) return;
  entrar(b.dataset.codigo, b.dataset.nivel ? Number(b.dataset.nivel) : undefined, b.dataset.destino);
});

$('#cerrar-panel').addEventListener('click', () => {
  $('#panel').hidden = true;
  campus.deseleccionar();
});

/* ================================================================== Programas */
const NIVELES = { PREGRADO: 'Pregrado', ESPECIALIZACION: 'Especialización', TECNICO: 'Técnico' };
let filtroNivel = 'TODOS';

function abrirProgramas() {
  salirDelRecorrido();
  const niveles = ['TODOS', ...new Set(datos.programas.map(p => p.nivel))];
  $('#programas-niveles').innerHTML = niveles.map(n =>
    `<button type="button" data-nivel="${n}" class="${n === filtroNivel ? 'activo' : ''}">${n === 'TODOS' ? 'Todos' : NIVELES[n] ?? n}</button>`).join('');
  pintarProgramas();
  $('#programas').hidden = false;
  setTimeout(() => $('#programas-buscar').focus(), 50);
}

function pintarProgramas() {
  const q = normalizar($('#programas-buscar').value.trim());
  const lista = datos.programas
    .filter(p => filtroNivel === 'TODOS' || p.nivel === filtroNivel)
    .filter(p => !q || normalizar(p.nombre + ' ' + p.facultad).includes(q))
    .sort((a, b) => (a.nivel === 'PREGRADO' ? 0 : 1) - (b.nivel === 'PREGRADO' ? 0 : 1) || a.nombre.localeCompare(b.nombre));
  $('#programas-lista').innerHTML = lista.length ? lista.map(p => `
    <button type="button" class="tarjeta-programa" data-id="${p.id}">
      <span class="nivel ${p.nivel}">${esc(NIVELES[p.nivel] ?? p.nivel)}</span>
      <strong>${esc(p.nombre)}</strong>
      <small>${esc(p.facultad)}${p.duracionSemestres ? ' · ' + p.duracionSemestres + ' semestres' : ''}</small>
    </button>`).join('') : '<p class="modal-sub">No hay programas con ese nombre.</p>';
}

$('#btn-programas').addEventListener('click', abrirProgramas);
$('#programas-buscar').addEventListener('input', pintarProgramas);
$('#programas-niveles').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-nivel]');
  if (!b) return;
  filtroNivel = b.dataset.nivel;
  $('#programas-niveles').querySelectorAll('button').forEach(x => x.classList.toggle('activo', x === b));
  pintarProgramas();
});
$('#programas-lista').addEventListener('click', (ev) => {
  const b = ev.target.closest('.tarjeta-programa');
  if (!b) return;
  $('#programas').hidden = true;
  mostrarPrograma(datos.programas.find(p => p.id === Number(b.dataset.id)));
});

const accionesPrograma = {
  preguntar: () => { abrirChat(); $('#pregunta').focus(); },
  inscribirme: () => preguntar(`¿Cómo me inscribo a ${programaActual.nombre}?`),
  admisiones: () => irALugar(datos.lugares.find(l => normalizar(l.nombre).startsWith('admisiones'))),
  bloque: () => mostrarEdificio(programaActual.edificioId),
  facultad: () => irALugar(datos.lugares.find(l => l.id === programaActual.lugarId), { conChat: true }),
};

/** Ficha del programa en el panel lateral (sobre el mapa). */
function fichaPrograma(p) {
  salirDelRecorrido();
  if (p.edificioId) campus.seleccionar(p.edificioId);
  $('#panel-contenido').innerHTML = `
    <div class="programa-detalle">
      <div class="chips"><span class="etiqueta" style="background:#2e7d32">${esc(NIVELES[p.nivel] ?? p.nivel)}</span>
        <span class="etiqueta" style="background:#4f6d8f">${esc(p.modalidad === 'HIBRIDA' ? 'Híbrida' : 'Presencial')}</span></div>
      <h2>${esc(p.nombre)}</h2>
      <p>${esc(p.facultad)}</p>
      <div class="datos">
        <div class="dato"><small>Duración</small><b>${p.duracionSemestres ? p.duracionSemestres + ' semestres' : '—'}</b></div>
        <div class="dato"><small>Título</small><b>${esc(p.titulo ?? '—')}</b></div>
      </div>
      <p>${esc(p.descripcion)}</p>
      <h3>¿Dónde?</h3>
      ${p.lugar ? `<div class="lugar"><strong>${esc(p.lugar)}</strong><span>${esc(p.ubicacion ?? '')}</span></div>` : ''}
      <div class="lugar"><strong>Inscripciones y matrícula</strong>
        <span>Admisiones, Registro y Control Académico (DARC), Bloque B · piso 1.</span></div>
      <div class="acciones-programa">
        ${p.lugarId ? `<button type="button" class="principal" data-accion="facultad">🚶 Ir a la ${esc(p.lugar)}</button>` : ''}
        <button type="button" ${p.lugarId ? '' : 'class="principal"'} data-accion="preguntar">💬 Preguntarle a Coopi sobre este programa</button>
        <button type="button" data-accion="inscribirme">📝 ¿Cómo me inscribo?</button>
        <button type="button" data-accion="admisiones">🚶 Ir a Admisiones (Bloque B)</button>
        ${p.edificioId ? `<button type="button" data-accion="bloque">🏢 Ver su bloque en el mapa</button>` : ''}
      </div>
    </div>`;
  $('#panel').hidden = false;
}

/**
 * Muestra un programa: ficha en el panel, el mapa se ubica y Coopi
 * pregunta en qué puede ayudar (las siguientes preguntas son sobre ese programa).
 */
function mostrarPrograma(p, { desdeCoopi = false } = {}) {
  if (!p) return;
  programaActual = p;
  $('#programa-activo-nombre').textContent = p.nombre;
  $('#programa-activo').hidden = false;

  // Si se conoce su facultad, se entra caminando hasta allá; si no, se muestra su ficha en el mapa
  const facultad = p.lugarId && datos.lugares.find(l => l.id === p.lugarId);
  const adentro = facultad && irALugar(facultad, { conChat: true });
  if (!adentro) {
    if (!p.edificioId) { campus.deseleccionar(); campus.vistaGeneral(); }
    fichaPrograma(p);
  }

  abrirChat();
  if (!desdeCoopi) {
    const donde = adentro ? ` Estás en la ${p.lugar} (${p.ubicacion}).` : '';
    const texto = `¡Bienvenido al programa de ${p.nombre}! 🎓 Es de la ${p.facultad}`
      + (p.duracionSemestres ? ` y dura ${p.duracionSemestres} semestres` : '') + `.${donde} ¿En qué te puedo ayudar con ${p.nombre}?`;
    agregarMensaje(texto, 'bot', { acciones: adentro ? [{ texto: '📋 Ver la ficha del programa', fn: () => fichaPrograma(p) }] : [] });
    voz.hablar(texto);
  }
  ponerSugerencias([`¿Qué se estudia en ${p.nombre}?`, '¿Cuánto dura?', '¿Qué título otorga?', '¿Cómo me inscribo?']);
}

function quitarPrograma() {
  programaActual = null;
  $('#programa-activo').hidden = true;
  ponerSugerencias(SUGERENCIAS);
}
$('#programa-activo-quitar').addEventListener('click', quitarPrograma);

/* ================================================================== Lugares */
const ICONOS = [
  [/cafeteria/, '🍽️', 'Restaurante · '], [/biblioteca/, '📚'], [/auditorio/, '🎭'], [/cancha sintetica/, '⚽'],
  [/voleibol/, '🏐'], [/clinica|odontolog/, '🦷'], [/admisiones/, '📝'], [/tesoreria|contabilidad/, '💳'],
  [/icetex/, '🎓'], [/ami/, '🤝'], [/lockers/, '🔐'], [/morfologia/, '🔬'], [/bonne vie|cafe/, '☕'],
  [/comuna/, '🏦'], [/corresponsales|market/, '🏧'], [/urkubici|bicicleta/, '🚲'], [/juegos/, '🏓'],
  [/porteria/, '🚪'], [/banos/, '🚻'], [/encuentro/, '🆘'], [/sala de espera/, '🪑'], [/archivo/, '🗂️'],
  [/dental deals/, '🛒'], [/conexion/, '↔️'],
];
const iconoDe = (nombre) => ICONOS.find(([re]) => re.test(normalizar(nombre))) ?? [null, '📍', ''];
const nombrePiso = (p) => (p < 0 ? `sótano ${-p}` : `piso ${p}`);

function abrirLugares() {
  salirDelRecorrido();
  const orden = (l) => (/cafeteria/.test(normalizar(l.nombre)) ? 0 : 1);
  $('#lugares-lista').innerHTML = [...datos.lugares].sort((a, b) => orden(a) - orden(b)).map(l => {
    const [, icono, prefijo = ''] = iconoDe(l.nombre);
    const e = datos.edificios.find(x => x.id === l.edificioId);
    const adentro = e && destinoDeLugar(e.codigo, l.nombre);
    return `<button type="button" class="tarjeta-lugar" data-id="${l.id}">
      <span class="icono-lugar">${icono}</span>
      <strong>${esc(prefijo + l.nombre)}</strong>
      <small>${esc((l.edificio ?? '').split(' - ')[0])} · ${nombrePiso(l.piso)}${adentro ? ' · 🚶 recorrido por dentro' : ''}</small>
    </button>`;
  }).join('');
  $('#lugares').hidden = false;
}

$('#btn-lugares').addEventListener('click', abrirLugares);
$('#lugares-lista').addEventListener('click', (ev) => {
  const b = ev.target.closest('.tarjeta-lugar');
  if (!b) return;
  $('#lugares').hidden = true;
  irALugar(datos.lugares.find(l => l.id === Number(b.dataset.id)));
});

document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', (ev) => {
  if (ev.target === m || ev.target.closest('[data-cerrar]')) m.hidden = true;
}));
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
});

/* ================================================================== Buscador */
$('#buscar').addEventListener('input', (ev) => {
  const q = normalizar(ev.target.value.trim());
  const lista = $('#resultados');
  if (q.length < 2) { lista.hidden = true; return; }

  const items = [
    ...datos.edificios.map(e => ({ titulo: e.nombre, sub: e.tipo === 'EDIFICIO' ? `${e.pisos} pisos · ${e.sotanos} sótanos` : 'Zona del campus', tipo: 'edificio', id: e.id })),
    ...datos.lugares.map(l => ({ titulo: l.nombre, sub: `${l.edificio} · ${nombrePiso(l.piso)}`, tipo: 'lugar', id: l.id,
      extra: /cafeteria/.test(normalizar(l.nombre)) ? 'restaurante comedor almuerzo' : '' })),
    ...datos.programas.map(p => ({ titulo: p.nombre, sub: `Programa · ${p.facultad}`, tipo: 'programa', id: p.id })),
  ].filter(i => normalizar(i.titulo + ' ' + (i.extra ?? '')).includes(q)).slice(0, 8);

  lista.innerHTML = items.length
    ? items.map(i => `<li data-tipo="${i.tipo}" data-id="${i.id}">${esc(i.titulo)}<small>${esc(i.sub)}</small></li>`).join('')
    : '<li>Sin resultados. Pregúntale a Coopi 👉</li>';
  lista.hidden = false;
});

$('#resultados').addEventListener('click', (ev) => {
  const li = ev.target.closest('li[data-tipo]');
  if (!li) return;
  const id = Number(li.dataset.id);
  if (li.dataset.tipo === 'programa') mostrarPrograma(datos.programas.find(p => p.id === id));
  else if (li.dataset.tipo === 'lugar') irALugar(datos.lugares.find(l => l.id === id));
  else mostrarEdificio(id);
  $('#resultados').hidden = true;
  $('#buscar').value = '';
});

/* ================================================================== Chat con Coopi */
const SUGERENCIAS = ['Llévame al programa de Ingeniería de Software', 'Quiero ver el restaurante', '¿Qué programas hay?', '¿Dónde queda la biblioteca?'];

function abrirChat() { $('#chat').classList.remove('cerrado'); }

function ponerSugerencias(lista) {
  $('#sugerencias').innerHTML = lista.map(s => `<button type="button">${esc(s)}</button>`).join('');
  $('#sugerencias').hidden = false;
}

function agregarMensaje(texto, quien, { edificioId, acciones = [] } = {}) {
  const edificio = datos.edificios.find(x => x.id === edificioId);
  const dentro = edificio && quien === 'bot' ? destinoEnTexto(edificio.codigo, texto) : null;
  const div = document.createElement('div');
  div.className = 'msg ' + quien;
  div.textContent = texto;
  const botones = [...acciones];
  if (edificio) botones.push({ texto: '📍 Ver en el mapa', fn: () => { salirDelRecorrido(); mostrarEdificio(edificioId); } });
  if (dentro) botones.push({ texto: `🚶 Llévame a: ${dentro.nombre}`, fn: () => entrar(edificio.codigo, dentro.nivel, dentro.destino) });
  if (botones.length) {
    const caja = document.createElement('div');
    caja.className = 'acciones';
    for (const b of botones) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = b.texto;
      btn.onclick = b.fn;
      caja.append(btn);
    }
    div.append(caja);
  }
  $('#mensajes').appendChild(div);
  $('#mensajes').scrollTop = $('#mensajes').scrollHeight;
  return div;
}

/**
 * Patrón COMMAND: el backend responde con una acción y aquí se ejecuta
 * (abrir la lista de programas, ir a un programa, a un lugar o a un bloque).
 */
const COMANDOS = {
  VER_PROGRAMAS: () => abrirProgramas(),
  IR_PROGRAMA: (a) => mostrarPrograma(datos.programas.find(p => p.id === a.programaId), { desdeCoopi: true }),
  IR_LUGAR: (a) => irALugar(datos.lugares.find(l => l.id === a.lugarId)),
  IR_EDIFICIO: (a) => { salirDelRecorrido(); mostrarEdificio(a.edificioId); },
  SALUDO: () => {},
};

async function preguntar(texto) {
  texto = texto.trim();
  if (!texto) return;
  abrirChat();
  agregarMensaje(texto, 'usuario');
  $('#pregunta').value = '';
  $('#sugerencias').hidden = true;
  const boton = $('#form-chat button[type=submit]');
  boton.disabled = true;
  const pensando = agregarMensaje('Coopi está escribiendo…', 'bot escribiendo');
  try {
    const r = await api.preguntar(texto, programaActual?.id ?? null);
    pensando.remove();
    const conAccion = r.accion && COMANDOS[r.accion.tipo];
    agregarMensaje(r.respuesta, 'bot', { edificioId: conAccion ? null : r.edificioId });
    voz.hablar(r.respuesta);
    if (conAccion) setTimeout(() => COMANDOS[r.accion.tipo](r.accion), 400);
    else if (r.edificioId && !recorrido.abierto) mostrarEdificio(r.edificioId);
  } catch (e) {
    pensando.remove();
    if (e.estado !== 401) agregarMensaje('No pude conectarme con el servidor. Intenta de nuevo en unos segundos.', 'bot');
  } finally {
    boton.disabled = false;
  }
}

$('#form-chat').addEventListener('submit', (ev) => {
  ev.preventDefault();
  preguntar($('#pregunta').value);
});
$('#sugerencias').addEventListener('click', (ev) => {
  if (ev.target.tagName === 'BUTTON') preguntar(ev.target.textContent);
});
$('#chat-cabecera').addEventListener('click', () => $('#chat').classList.toggle('cerrado'));
if (window.innerWidth < 760) $('#chat').classList.add('cerrado');

/* ================================================================== Voz: "Ey Coopi" */
const voz = new Voz({
  alPreguntar: (texto) => preguntar(texto),
  alActivarse: () => {
    abrirChat();
    const t = '¡Hola! ¿Cómo estás? ¿En qué te puedo ayudar hoy?';
    agregarMensaje(t, 'bot');
    voz.hablar(t);
  },
  alEstado: (e, detalle) => {
    $('#btn-mic').classList.toggle('escuchando', e === 'escuchando' || e === 'esperando');
    $('#pregunta').placeholder = e === 'escuchando' || e === 'esperando' ? 'Te escucho…' : 'Escribe o habla con Coopi…';
    pintarBotonClave();
    if (e === 'error' && detalle) agregarMensaje(detalle, 'bot');
  },
});

function pintarBotonClave() {
  const b = $('#btn-clave');
  b.classList.toggle('activo', voz.modoClave);
  b.innerHTML = `🎙️ «Ey Coopi»: <b>${voz.modoClave ? 'escuchando' : 'apagado'}</b>`;
}

if (!voz.puedeEscuchar) {
  for (const id of ['#btn-clave', '#btn-mic']) {
    $(id).disabled = true;
    $(id).title = 'Tu navegador no permite hablar por voz. Usa Google Chrome o Microsoft Edge.';
  }
}
$('#btn-hablar').classList.toggle('activo', voz.hablarActivo);
$('#btn-hablar').disabled = !voz.puedeHablar;

$('#btn-mic').addEventListener('click', () => {
  if ($('#btn-mic').classList.contains('escuchando') && !voz.modoClave) return voz.detener();
  voz.escucharUnaVez();
});
$('#btn-clave').addEventListener('click', () => {
  const activo = voz.palabraClave(!voz.modoClave);
  pintarBotonClave();
  if (activo) agregarMensaje('Te estoy escuchando. Di «Ey Coopi» y luego tu pregunta, por ejemplo: «Ey Coopi, llévame a la biblioteca».', 'bot');
});
$('#btn-hablar').addEventListener('click', () => {
  voz.hablarActivo = !voz.hablarActivo;
  if (!voz.hablarActivo) voz.callar();
  $('#btn-hablar').classList.toggle('activo', voz.hablarActivo);
  $('#btn-hablar').textContent = voz.hablarActivo ? '🔊 Voz' : '🔇 Sin voz';
});

/* ================================================================== Controles de vista */
$('#btn-sotanos').addEventListener('click', (ev) => {
  const activo = campus.alternarSotanos();
  ev.currentTarget.classList.toggle('activo', activo);
  ev.currentTarget.textContent = activo ? 'Ocultar sótanos' : 'Ver sótanos';
});
$('#btn-vista').addEventListener('click', () => {
  $('#panel').hidden = true;
  campus.deseleccionar();
  campus.vistaGeneral();
});

/* ================================================================== Inicio */
async function iniciar() {
  if (!(await cargarDatos())) return;
  carga.terminar();
  try {
    const saludo = await iniciarSesion();
    mostrarUsuario();
    saludar(saludo);
  } catch {
    agregarMensaje('No pude conectarme con el servidor. Recarga la página en unos segundos.', 'bot');
  }
}
$('#carga-reintentar').addEventListener('click', iniciar);
iniciar();
