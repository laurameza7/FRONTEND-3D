import './estilos.css';
import { api } from './api.js';
import { Campus3D } from './campus3d.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const datos = { edificios: [], lugares: [], programas: [] };
const campus = new Campus3D($('#escena'), { alSeleccionar: mostrarEdificio });

/* ------------------------------------------------------------------ Estado del backend */
function estado(tipo, texto) {
  const el = $('#estado');
  el.className = 'estado ' + tipo;
  el.querySelector('.texto').textContent = texto;
}

async function cargarDatos() {
  estado('', 'Conectando con el servidor…');
  // El plan gratuito de Render "duerme" el backend; puede tardar ~1 minuto en despertar.
  const aviso = setTimeout(() => estado('', 'Despertando el servidor (puede tardar un minuto)…'), 4000);
  for (let intento = 1; intento <= 20; intento++) {
    try {
      const [edificios, lugares, programas] = await Promise.all([api.edificios(), api.lugares(), api.programas()]);
      clearTimeout(aviso);
      Object.assign(datos, { edificios, lugares, programas });
      campus.cargar(edificios, lugares);
      const bloques = edificios.filter(e => e.tipo === 'EDIFICIO').length;
      estado('ok', `En línea · ${bloques} bloques · ${programas.length} programas`);
      return;
    } catch {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  clearTimeout(aviso);
  estado('error', 'No se pudo conectar con el servidor');
}

/* ------------------------------------------------------------------ Panel del bloque */
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
    pisosHtml = `<h3>Piso por piso</h3><div class="pisos">${niveles.map(p => {
      const aqui = lugares.filter(l => l.piso === p || (l.nombre === 'Biblioteca' && p === 3 && l.piso === 2));
      return `<div class="piso ${p < 0 ? 'sotano' : ''}"><b>${p < 0 ? 'Sótano ' + -p : 'Piso ' + p}</b>
        <div class="contenido ${aqui.length ? '' : 'vacio'}">${aqui.length
          ? aqui.map(l => `<div><strong>${esc(l.nombre)}</strong>${l.telefono ? `<span>☎ ${esc(l.telefono)}</span>` : ''}</div>`).join('')
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
    ${pisosHtml}
    ${programas.length ? `<h3>Programas con clases aquí</h3>${programas.map(p => `
      <div class="lugar"><strong>${esc(p.nombre)}</strong><span>${esc(p.titulo)}</span></div>`).join('')}` : ''}
  `;
  $('#panel').hidden = false;
}

$('#cerrar-panel').addEventListener('click', () => {
  $('#panel').hidden = true;
  campus.deseleccionar();
});

/* ------------------------------------------------------------------ Buscador */
const nombrePiso = (p) => (p < 0 ? `sótano ${-p}` : `piso ${p}`);
const normalizar = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

$('#buscar').addEventListener('input', (ev) => {
  const q = normalizar(ev.target.value.trim());
  const lista = $('#resultados');
  if (q.length < 2) { lista.hidden = true; return; }

  const items = [
    ...datos.edificios.map(e => ({ titulo: e.nombre, sub: e.tipo === 'EDIFICIO' ? `${e.pisos} pisos · ${e.sotanos} sótanos` : 'Zona del campus', id: e.id })),
    ...datos.lugares.map(l => ({ titulo: l.nombre, sub: `${l.edificio} · ${nombrePiso(l.piso)}`, id: l.edificioId })),
    ...datos.programas.map(p => ({ titulo: p.nombre, sub: `Programa · ${p.facultad}`, id: p.edificioId, programa: p.nombre })),
  ].filter((i, n, todos) => normalizar(i.titulo).includes(q)
    && todos.findIndex(o => o.titulo === i.titulo && o.id === i.id) === n).slice(0, 8);

  lista.innerHTML = items.length
    ? items.map(i => `<li data-id="${i.id ?? ''}" data-programa="${esc(i.programa ?? '')}">${esc(i.titulo)}<small>${esc(i.sub)}</small></li>`).join('')
    : '<li>Sin resultados. Pregúntale a Coopi 👉</li>';
  lista.hidden = false;
});

$('#resultados').addEventListener('click', (ev) => {
  const li = ev.target.closest('li[data-id]');
  if (!li) return;
  if (li.dataset.programa) {               // los programas no tienen bloque fijo: se le pregunta a Coopi
    $('#chat').classList.remove('cerrado');
    preguntar(`Háblame del programa ${li.dataset.programa}`);
  } else if (li.dataset.id) mostrarEdificio(Number(li.dataset.id));
  $('#resultados').hidden = true;
  $('#buscar').value = '';
});

/* ------------------------------------------------------------------ Chat con la IA */
const SUGERENCIAS = ['¿Qué programas hay?', '¿Dónde queda la biblioteca?', '¿Dónde está el auditorio?', '¿Cómo me inscribo?'];

function agregarMensaje(texto, quien, edificioId) {
  const div = document.createElement('div');
  div.className = 'msg ' + quien;
  div.textContent = texto;
  if (edificioId) {
    const ver = document.createElement('span');
    ver.className = 'ver';
    ver.textContent = '📍 Ver en el mapa';
    ver.onclick = () => mostrarEdificio(edificioId);
    div.append(document.createElement('br'), ver);
  }
  $('#mensajes').appendChild(div);
  $('#mensajes').scrollTop = $('#mensajes').scrollHeight;
  return div;
}

async function preguntar(texto) {
  texto = texto.trim();
  if (!texto) return;
  agregarMensaje(texto, 'usuario');
  $('#pregunta').value = '';
  $('#sugerencias').hidden = true;
  const boton = $('#form-chat button');
  boton.disabled = true;
  const pensando = agregarMensaje('Coopi está escribiendo…', 'bot escribiendo');
  try {
    const r = await api.preguntar(texto);
    pensando.remove();
    agregarMensaje(r.respuesta, 'bot', r.edificioId);
    if (r.edificioId) mostrarEdificio(r.edificioId);
  } catch {
    pensando.remove();
    agregarMensaje('No pude conectarme con el servidor. Intenta de nuevo en unos segundos.', 'bot');
  } finally {
    boton.disabled = false;
  }
}

$('#form-chat').addEventListener('submit', (ev) => {
  ev.preventDefault();
  preguntar($('#pregunta').value);
});

$('#sugerencias').innerHTML = SUGERENCIAS.map(s => `<button type="button">${esc(s)}</button>`).join('');
$('#sugerencias').addEventListener('click', (ev) => {
  if (ev.target.tagName === 'BUTTON') preguntar(ev.target.textContent);
});

$('#chat-cabecera').addEventListener('click', () => $('#chat').classList.toggle('cerrado'));
if (window.innerWidth < 760) $('#chat').classList.add('cerrado');

agregarMensaje('¡Hola! Soy Coopi, el asistente del campus Pasto (Torobajo). Pregúntame por programas, la biblioteca, el auditorio, pagos o cómo llegar a un bloque. 😊', 'bot');

/* ------------------------------------------------------------------ Controles de vista */
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

cargarDatos();
