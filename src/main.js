import './styles.css';
import { api, ApiError } from './api.js';
import { Campus3D } from './campus3d.js';
import { Walkthrough, hasInterior, destinationOfPlace, destinationInText } from './walkthrough.js';
import { requestAccess, savedSession, logout } from './session.js';
import { Voice } from './voice.js';

const $ = (sel) => document.querySelector(sel);
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normalize = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const data = { buildings: [], places: [], programs: [] };
let session = null;
let currentProgram = null;     // program being discussed with Coopi

const campus = new Campus3D($('#scene'), { onSelect: showBuilding });
const walkthrough = new Walkthrough({ onExit: () => campus.pauseRendering(false) });
window.ucc3d = { campus, walkthrough };   // access for debugging from the console

/* ================================================================== Loading screen */
const loading = {
  progressBar(percent, text) {
    $('#loading-progress').style.width = percent + '%';
    if (text) $('#loading-text').textContent = text;
  },
  finish() {
    this.progressBar(100, '¡Listo!');
    setTimeout(() => $('#loading').classList.add('faded'), 350);
    setTimeout(() => { $('#loading').hidden = true; }, 900);
  },
};

function status(type, text) {
  const el = $('#status');
  el.className = 'status ' + type;
  el.querySelector('.text').textContent = text;
}

async function loadData() {
  $('#loading-retry').hidden = true;
  loading.progressBar(15, 'Cargando el mapa del campus, espere un momento');
  status('', 'Conectando con el servidor…');
  loading.progressBar(30, 'Conectando con el servidor');
  // Render's free plan "puts the backend to sleep"; it can take ~1 minute to wake up.
  let progress = 30;
  const notice = setTimeout(() => {
    $('#loading-notice').hidden = false;
    loading.progressBar(progress, 'Cargando el mapa del campus, espere un momento');
    status('', 'Despertando el servidor (puede tardar un minuto)…');
  }, 4000);
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      const [buildings, places, programs] = await Promise.all([api.buildings(), api.places(), api.programs()]);
      clearTimeout(notice);
      $('#loading-notice').hidden = true;
      loading.progressBar(88, 'Construyendo el campus en 3D');
      await new Promise(r => setTimeout(r, 30));       // lets the message be painted
      Object.assign(data, { buildings, places, programs });
      campus.load(buildings, places);
      const blocks = buildings.filter(e => e.type === 'BUILDING').length;
      status('ok', `En línea · ${blocks} bloques · ${programs.length} programas`);
      return true;
    } catch {
      progress = Math.min(82, progress + 3);
      loading.progressBar(progress);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  clearTimeout(notice);
  status('error', 'No se pudo conectar con el servidor');
  loading.progressBar(100, 'No se pudo conectar con el servidor');
  $('#loading-notice').hidden = true;
  $('#loading-retry').hidden = false;
  return false;
}

/* ================================================================== Session */
async function startSession() {
  const saved = savedSession();
  if (saved?.token) {
    api.useToken(saved.token);
    try {
      const { answer } = await api.greeting();     // checks that the token is still valid
      session = saved;
      return answer;
    } catch { logout(); }
  }
  session = await requestAccess();
  return (await api.greeting()).answer;
}

function showUser() {
  $('#user').hidden = !session;
  $('#user-name').textContent = session ? (session.role === 'GUEST' ? '👤 Invitado' : '👤 ' + session.name.split(' ')[0]) : '';
}

async function greet(text) {
  openChat();
  const actions = session && session.role !== 'GUEST'
    ? [{ text: '🕘 Ver mis conversaciones anteriores', fn: showHistory }] : [];
  addMessage(text, 'bot', { actions });
  voice.speak(text);
  setSuggestions(SUGGESTIONS);
}

let renewing = false;
api.onSessionExpired(async () => {
  if (renewing) return;
  renewing = true;
  logout();
  addMessage('Tu sesión terminó. Vuelve a ingresar para seguir hablando conmigo.', 'bot');
  session = await requestAccess();
  showUser();
  renewing = false;
  greet((await api.greeting()).answer);
});

$('#btn-logout').addEventListener('click', async () => {
  voice.wakeWord(false);
  voice.stopSpeaking();
  logout();
  session = null;
  showUser();
  clearProgram();
  $('#messages').innerHTML = '';
  session = await requestAccess();
  showUser();
  greet((await api.greeting()).answer);
});

async function showHistory() {
  try {
    const h = await api.history();
    if (!h.length) return addMessage('Aún no tienes conversaciones guardadas conmigo.', 'bot');
    addMessage('Estas son tus últimas preguntas:\n' + h.slice(-8).map(m => `• ${m.question}  (${m.date})`).join('\n'), 'bot');
  } catch {
    addMessage('No pude traer tu historial en este momento.', 'bot');
  }
}

/* ================================================================== Navigation */
/** Walks into a block (optionally to a specific floor and place). */
function enter(code, level, destination, { withChat = false } = {}) {
  campus.pauseRendering(true);
  if (withChat) openChat();
  else $('#chat').classList.add('closed');   // the chat is minimized so it does not cover the view
  $('#panel').hidden = true;
  if (walkthrough.open && walkthrough.code === code) walkthrough.goTo(level, destination);
  else {
    if (walkthrough.open) walkthrough.close();
    campus.pauseRendering(true);
    walkthrough.openAt(code, level, destination);
  }
}

function exitWalkthrough() {
  if (walkthrough.open) walkthrough.close();
}

/** Goes to a place: if it has an interior it walks in; otherwise it shows it on the map. */
function goToPlace(place, options) {
  if (!place) return false;
  const e = data.buildings.find(x => x.id === place.buildingId);
  const d = e && destinationOfPlace(e.code, place.name);
  if (d) { enter(e.code, d.level, d.destination, options); return true; }
  if (e) { exitWalkthrough(); showBuilding(e.id); }
  return false;
}

/* ================================================================== Block panel */
function showBuilding(id) {
  const e = data.buildings.find(x => x.id === id);
  if (!e) return;
  campus.select(id);
  const places = data.places.filter(l => l.buildingId === id);
  const programs = data.programs.filter(p => p.buildingId === id);

  const chips = e.type === 'BUILDING'
    ? `<span class="label" style="background:${escapeHtml(e.color)}">${e.floors} pisos</span>
       ${e.basements ? `<span class="label" style="background:#4f6d8f">${e.basements} sótanos</span>` : ''}`
    : `<span class="label" style="background:#7b8a97">${e.type === 'ENTRANCE' ? 'Entrada' : 'Zona abierta'}</span>`;

  // Floors from top to bottom, including the basements
  let floorsHtml = '';
  if (e.type === 'BUILDING') {
    const levels = [];
    for (let p = e.floors; p >= 1; p--) levels.push(p);
    for (let s = 1; s <= (e.basements || 0); s++) levels.push(-s);
    const levelLabel = (p) => p > 0 ? 'Piso ' + p : (e.code === 'B' && p === -1 ? 'Piso 0 · Sót. 1' : 'Sótano ' + -p);
    floorsHtml = `<h3>Piso por piso</h3><div class="floors">${levels.map(p => {
      const here = places.filter(l => l.floor === p || (l.name === 'Biblioteca' && p === 3 && l.floor === 2));
      return `<div class="floor ${p < 0 ? 'basement' : ''}"><b>${levelLabel(p)}</b>
        <div class="content ${here.length ? '' : 'empty'}">${here.length
          ? here.map(l => {
              const d = destinationOfPlace(e.code, l.name);
              return `<div>${d ? `<button class="place-go" type="button" data-code="${e.code}" data-level="${d.level}" data-destination="${d.destination}">🚶 Ir</button>` : ''}<strong>${escapeHtml(l.name)}</strong>${l.phone ? `<span>☎ ${escapeHtml(l.phone)}</span>` : ''}</div>`;
            }).join('')
          : 'Sin información registrada'}</div></div>`;
    }).join('')}</div>`;
  } else if (places.length) {
    floorsHtml = `<h3>Qué encuentras aquí</h3>${places.map(l => `
      <div class="place"><strong>${escapeHtml(l.name)}</strong>${l.description ? `<span>${escapeHtml(l.description)}</span>` : ''}
        ${l.phone ? `<span>☎ ${escapeHtml(l.phone)}</span>` : ''}</div>`).join('')}`;
  }

  $('#panel-content').innerHTML = `
    <div class="chips">${chips}</div>
    <h2>${escapeHtml(e.name)}</h2>
    <p>${escapeHtml(e.description)}</p>
    ${hasInterior(e.code) ? `<button class="btn-enter" type="button" data-code="${e.code}">🚶 Entrar y recorrer el ${escapeHtml(e.name)} por dentro</button>` : ''}
    ${floorsHtml}
    ${programs.length ? `<h3>Programas con práctica aquí</h3>${programs.map(p => `
      <div class="place" data-program="${p.id}" style="cursor:pointer"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.degreeTitle)}</span></div>`).join('')}` : ''}
  `;
  $('#panel').hidden = false;
}

$('#panel-content').addEventListener('click', (ev) => {
  const prog = ev.target.closest('[data-program]');
  if (prog) return showProgram(data.programs.find(p => p.id === Number(prog.dataset.program)));
  const act = ev.target.closest('[data-action]');
  if (act) return programActions[act.dataset.action]?.();
  const b = ev.target.closest('.btn-enter, .place-go');
  if (!b) return;
  enter(b.dataset.code, b.dataset.level ? Number(b.dataset.level) : undefined, b.dataset.destination);
});

$('#close-panel').addEventListener('click', () => {
  $('#panel').hidden = true;
  campus.deselect();
});

/* ================================================================== Programs */
const LEVELS = { UNDERGRADUATE: 'Pregrado', SPECIALIZATION: 'Especialización', TECHNICAL: 'Técnico' };
let levelFilter = 'ALL';

function openPrograms() {
  exitWalkthrough();
  const levels = ['ALL', ...new Set(data.programs.map(p => p.level))];
  $('#programs-levels').innerHTML = levels.map(n =>
    `<button type="button" data-level="${n}" class="${n === levelFilter ? 'active' : ''}">${n === 'ALL' ? 'Todos' : LEVELS[n] ?? n}</button>`).join('');
  paintPrograms();
  $('#programs').hidden = false;
  setTimeout(() => $('#programs-search').focus(), 50);
}

function paintPrograms() {
  const q = normalize($('#programs-search').value.trim());
  const list = data.programs
    .filter(p => levelFilter === 'ALL' || p.level === levelFilter)
    .filter(p => !q || normalize(p.name + ' ' + p.faculty).includes(q))
    .sort((a, b) => (a.level === 'UNDERGRADUATE' ? 0 : 1) - (b.level === 'UNDERGRADUATE' ? 0 : 1) || a.name.localeCompare(b.name));
  $('#programs-list').innerHTML = list.length ? list.map(p => `
    <button type="button" class="program-card" data-id="${p.id}">
      <span class="level ${p.level}">${escapeHtml(LEVELS[p.level] ?? p.level)}</span>
      <strong>${escapeHtml(p.name)}</strong>
      <small>${escapeHtml(p.faculty)}${p.durationSemesters ? ' · ' + p.durationSemesters + ' semestres' : ''}</small>
    </button>`).join('') : '<p class="modal-sub">No hay programas con ese nombre.</p>';
}

$('#btn-programs').addEventListener('click', openPrograms);
$('#programs-search').addEventListener('input', paintPrograms);
$('#programs-levels').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-level]');
  if (!b) return;
  levelFilter = b.dataset.level;
  $('#programs-levels').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
  paintPrograms();
});
$('#programs-list').addEventListener('click', (ev) => {
  const b = ev.target.closest('.program-card');
  if (!b) return;
  $('#programs').hidden = true;
  showProgram(data.programs.find(p => p.id === Number(b.dataset.id)));
});

const programActions = {
  ask: () => { openChat(); $('#question').focus(); },
  enroll: () => ask(`¿Cómo me inscribo a ${currentProgram.name}?`),
  admissions: () => goToPlace(data.places.find(l => normalize(l.name).startsWith('admisiones'))),
  block: () => showBuilding(currentProgram.buildingId),
  faculty: () => goToPlace(data.places.find(l => l.id === currentProgram.placeId), { withChat: true }),
};

/** Program card in the side panel (over the map). */
function programCard(p) {
  exitWalkthrough();
  if (p.buildingId) campus.select(p.buildingId);
  $('#panel-content').innerHTML = `
    <div class="program-detail">
      <div class="chips"><span class="label" style="background:#2e7d32">${escapeHtml(LEVELS[p.level] ?? p.level)}</span>
        <span class="label" style="background:#4f6d8f">${escapeHtml(p.modality === 'HYBRID' ? 'Híbrida' : 'Presencial')}</span></div>
      <h2>${escapeHtml(p.name)}</h2>
      <p>${escapeHtml(p.faculty)}</p>
      <div class="data">
        <div class="data-item"><small>Duración</small><b>${p.durationSemesters ? p.durationSemesters + ' semestres' : '—'}</b></div>
        <div class="data-item"><small>Título</small><b>${escapeHtml(p.degreeTitle ?? '—')}</b></div>
      </div>
      <p>${escapeHtml(p.description)}</p>
      <h3>¿Dónde?</h3>
      ${p.place ? `<div class="place"><strong>${escapeHtml(p.place)}</strong><span>${escapeHtml(p.location ?? '')}</span></div>` : ''}
      <div class="place"><strong>Inscripciones y matrícula</strong>
        <span>Admisiones, Registro y Control Académico (DARC), Bloque B · piso 1.</span></div>
      <div class="program-actions">
        ${p.placeId ? `<button type="button" class="primary" data-action="faculty">🚶 Ir a la ${escapeHtml(p.place)}</button>` : ''}
        <button type="button" ${p.placeId ? '' : 'class="primary"'} data-action="ask">💬 Preguntarle a Coopi sobre este programa</button>
        <button type="button" data-action="enroll">📝 ¿Cómo me inscribo?</button>
        <button type="button" data-action="admissions">🚶 Ir a Admisiones (Bloque B)</button>
        ${p.buildingId ? `<button type="button" data-action="block">🏢 Ver su bloque en el mapa</button>` : ''}
      </div>
    </div>`;
  $('#panel').hidden = false;
}

/**
 * Shows a program: card in the panel, the map moves to it and Coopi
 * asks how it can help (the next questions are about that program).
 */
function showProgram(p, { fromCoopi = false } = {}) {
  if (!p) return;
  currentProgram = p;
  $('#active-program-name').textContent = p.name;
  $('#active-program').hidden = false;

  // If its faculty is known, it walks there; otherwise its card is shown on the map
  const faculty = p.placeId && data.places.find(l => l.id === p.placeId);
  const inside = faculty && goToPlace(faculty, { withChat: true });
  if (!inside) {
    if (!p.buildingId) { campus.deselect(); campus.overview(); }
    programCard(p);
  }

  openChat();
  if (!fromCoopi) {
    const where = inside ? ` Estás en la ${p.place} (${p.location}).` : '';
    const text = `¡Bienvenido al programa de ${p.name}! 🎓 Es de la ${p.faculty}`
      + (p.durationSemesters ? ` y dura ${p.durationSemesters} semestres` : '') + `.${where} ¿En qué te puedo ayudar con ${p.name}?`;
    addMessage(text, 'bot', { actions: inside ? [{ text: '📋 Ver la ficha del programa', fn: () => programCard(p) }] : [] });
    voice.speak(text);
  }
  setSuggestions([`¿Qué se estudia en ${p.name}?`, '¿Cuánto dura?', '¿Qué título otorga?', '¿Cómo me inscribo?']);
}

function clearProgram() {
  currentProgram = null;
  $('#active-program').hidden = true;
  setSuggestions(SUGGESTIONS);
}
$('#active-program-clear').addEventListener('click', clearProgram);

/* ================================================================== Places */
const ICONS = [
  [/cafeteria/, '🍽️', 'Restaurante · '], [/biblioteca/, '📚'], [/auditorio/, '🎭'], [/cancha sintetica/, '⚽'],
  [/voleibol/, '🏐'], [/clinica|odontolog/, '🦷'], [/admisiones/, '📝'], [/tesoreria|contabilidad/, '💳'],
  [/icetex/, '🎓'], [/ami/, '🤝'], [/lockers/, '🔐'], [/morfologia/, '🔬'], [/bonne vie|cafe/, '☕'],
  [/comuna/, '🏦'], [/corresponsales|market/, '🏧'], [/urkubici|bicicleta/, '🚲'], [/juegos/, '🏓'],
  [/porteria/, '🚪'], [/banos/, '🚻'], [/encuentro/, '🆘'], [/sala de espera/, '🪑'], [/archivo/, '🗂️'],
  [/dental deals/, '🛒'], [/conexion/, '↔️'],
];
const iconOf = (name) => ICONS.find(([re]) => re.test(normalize(name))) ?? [null, '📍', ''];
const floorName = (p) => (p < 0 ? `sótano ${-p}` : `piso ${p}`);

function openPlaces() {
  exitWalkthrough();
  const order = (l) => (/cafeteria/.test(normalize(l.name)) ? 0 : 1);
  $('#places-list').innerHTML = [...data.places].sort((a, b) => order(a) - order(b)).map(l => {
    const [, icon, prefix = ''] = iconOf(l.name);
    const e = data.buildings.find(x => x.id === l.buildingId);
    const inside = e && destinationOfPlace(e.code, l.name);
    return `<button type="button" class="place-card" data-id="${l.id}">
      <span class="place-icon">${icon}</span>
      <strong>${escapeHtml(prefix + l.name)}</strong>
      <small>${escapeHtml((l.building ?? '').split(' - ')[0])} · ${floorName(l.floor)}${inside ? ' · 🚶 recorrido por dentro' : ''}</small>
    </button>`;
  }).join('');
  $('#places').hidden = false;
}

$('#btn-places').addEventListener('click', openPlaces);
$('#places-list').addEventListener('click', (ev) => {
  const b = ev.target.closest('.place-card');
  if (!b) return;
  $('#places').hidden = true;
  goToPlace(data.places.find(l => l.id === Number(b.dataset.id)));
});

document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', (ev) => {
  if (ev.target === m || ev.target.closest('[data-close]')) m.hidden = true;
}));
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
});

/* ================================================================== Search */
$('#search').addEventListener('input', (ev) => {
  const q = normalize(ev.target.value.trim());
  const list = $('#results');
  if (q.length < 2) { list.hidden = true; return; }

  const items = [
    ...data.buildings.map(e => ({ title: e.name, sub: e.type === 'BUILDING' ? `${e.floors} pisos · ${e.basements} sótanos` : 'Zona del campus', type: 'building', id: e.id })),
    ...data.places.map(l => ({ title: l.name, sub: `${l.building} · ${floorName(l.floor)}`, type: 'place', id: l.id,
      extra: /cafeteria/.test(normalize(l.name)) ? 'restaurante comedor almuerzo' : '' })),
    ...data.programs.map(p => ({ title: p.name, sub: `Programa · ${p.faculty}`, type: 'program', id: p.id })),
  ].filter(i => normalize(i.title + ' ' + (i.extra ?? '')).includes(q)).slice(0, 8);

  list.innerHTML = items.length
    ? items.map(i => `<li data-type="${i.type}" data-id="${i.id}">${escapeHtml(i.title)}<small>${escapeHtml(i.sub)}</small></li>`).join('')
    : '<li>Sin resultados. Pregúntale a Coopi 👉</li>';
  list.hidden = false;
});

$('#results').addEventListener('click', (ev) => {
  const li = ev.target.closest('li[data-type]');
  if (!li) return;
  const id = Number(li.dataset.id);
  if (li.dataset.type === 'program') showProgram(data.programs.find(p => p.id === id));
  else if (li.dataset.type === 'place') goToPlace(data.places.find(l => l.id === id));
  else showBuilding(id);
  $('#results').hidden = true;
  $('#search').value = '';
});

/* ================================================================== Chat with Coopi */
const SUGGESTIONS = ['Llévame al programa de Ingeniería de Software', 'Quiero ver el restaurante', '¿Qué programas hay?', '¿Dónde queda la biblioteca?'];

function openChat() { $('#chat').classList.remove('closed'); }

function setSuggestions(list) {
  $('#suggestions').innerHTML = list.map(s => `<button type="button">${escapeHtml(s)}</button>`).join('');
  $('#suggestions').hidden = false;
}

function addMessage(text, who, { buildingId, actions = [] } = {}) {
  const building = data.buildings.find(x => x.id === buildingId);
  const insideTarget = building && who === 'bot' ? destinationInText(building.code, text) : null;
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.textContent = text;
  const buttons = [...actions];
  if (building) buttons.push({ text: '📍 Ver en el mapa', fn: () => { exitWalkthrough(); showBuilding(buildingId); } });
  if (insideTarget) buttons.push({ text: `🚶 Llévame a: ${insideTarget.name}`, fn: () => enter(building.code, insideTarget.level, insideTarget.destination) });
  if (buttons.length) {
    const box = document.createElement('div');
    box.className = 'actions';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = b.text;
      btn.onclick = b.fn;
      box.append(btn);
    }
    div.append(box);
  }
  $('#messages').appendChild(div);
  $('#messages').scrollTop = $('#messages').scrollHeight;
  return div;
}

/**
 * COMMAND pattern: the backend answers with an action and it is executed here
 * (open the list of programs, go to a program, to a place or to a block).
 */
const COMMANDS = {
  SHOW_PROGRAMS: () => openPrograms(),
  GO_TO_PROGRAM: (a) => showProgram(data.programs.find(p => p.id === a.programId), { fromCoopi: true }),
  GO_TO_PLACE: (a) => goToPlace(data.places.find(l => l.id === a.placeId)),
  GO_TO_BUILDING: (a) => { exitWalkthrough(); showBuilding(a.buildingId); },
  GREETING: () => {},
};

let waitingAnswer = false;   // ignores new questions while Coopi is still answering the previous one

async function ask(text) {
  text = text.trim();
  if (!text || waitingAnswer) return;
  waitingAnswer = true;
  openChat();
  addMessage(text, 'user');
  $('#question').value = '';
  $('#suggestions').hidden = true;
  const button = $('#chat-form button[type=submit]');
  button.disabled = true;
  const thinking = addMessage('Coopi está escribiendo…', 'bot typing');
  try {
    const r = await api.ask(text, currentProgram?.id ?? null);
    thinking.remove();
    const withAction = r.action && COMMANDS[r.action.type];
    addMessage(r.answer, 'bot', { buildingId: withAction ? null : r.buildingId });
    voice.speak(r.answer);
    if (withAction) setTimeout(() => COMMANDS[r.action.type](r.action), 400);
    else if (r.buildingId && !walkthrough.open) showBuilding(r.buildingId);
  } catch (e) {
    thinking.remove();
    if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401) addMessage(e.message, 'bot');
    else if (e.status !== 401) addMessage('No pude enviar tu mensaje. Revisa tu conexión o escríbelo de otra forma e intenta de nuevo.', 'bot');
  } finally {
    button.disabled = false;
    waitingAnswer = false;
  }
}

$('#chat-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  ask($('#question').value);
});
$('#suggestions').addEventListener('click', (ev) => {
  if (ev.target.tagName === 'BUTTON') ask(ev.target.textContent);
});
$('#chat-header').addEventListener('click', () => $('#chat').classList.toggle('closed'));
if (window.innerWidth < 760) $('#chat').classList.add('closed');

/* ================================================================== Voice: "Ey Coopi" */
const voice = new Voice({
  onQuestion: (text) => ask(text),
  onActivate: () => {
    openChat();
    const t = '¡Hola! ¿Cómo estás? ¿En qué te puedo ayudar hoy?';
    addMessage(t, 'bot');
    voice.speak(t);
  },
  onStatus: (e, detail) => {
    $('#btn-mic').classList.toggle('listening', e === 'listening' || e === 'waiting');
    $('#question').placeholder = e === 'listening' || e === 'waiting' ? 'Te escucho…' : 'Escribe o habla con Coopi…';
    paintWakeButton();
    if (e === 'error' && detail) addMessage(detail, 'bot');
  },
});

function paintWakeButton() {
  const b = $('#btn-wake');
  b.classList.toggle('active', voice.wakeMode);
  b.innerHTML = `🎙️ «Ey Coopi»: <b>${voice.wakeMode ? 'listening' : 'off'}</b>`;
}

if (!voice.canListen) {
  for (const id of ['#btn-wake', '#btn-mic']) {
    $(id).disabled = true;
    $(id).title = 'Tu navegador no permite hablar por voz. Usa Google Chrome o Microsoft Edge.';
  }
}
$('#btn-speak').classList.toggle('active', voice.speechOn);
$('#btn-speak').disabled = !voice.canSpeak;

$('#btn-mic').addEventListener('click', () => {
  if ($('#btn-mic').classList.contains('listening') && !voice.wakeMode) return voice.stop();
  voice.listenOnce();
});
$('#btn-wake').addEventListener('click', () => {
  const active = voice.wakeWord(!voice.wakeMode);
  paintWakeButton();
  if (active) addMessage('Te estoy escuchando. Di «Ey Coopi» y luego tu pregunta, por ejemplo: «Ey Coopi, llévame a la biblioteca».', 'bot');
});
$('#btn-speak').addEventListener('click', () => {
  voice.speechOn = !voice.speechOn;
  if (!voice.speechOn) voice.stopSpeaking();
  $('#btn-speak').classList.toggle('active', voice.speechOn);
  $('#btn-speak').textContent = voice.speechOn ? '🔊 Voz' : '🔇 Sin voz';
});

/* ================================================================== View controls */
$('#btn-basements').addEventListener('click', (ev) => {
  const active = campus.toggleBasements();
  ev.currentTarget.classList.toggle('active', active);
  ev.currentTarget.textContent = active ? 'Ocultar sótanos' : 'Ver sótanos';
});
$('#btn-view').addEventListener('click', () => {
  $('#panel').hidden = true;
  campus.deselect();
  campus.overview();
});

/* ================================================================== Start */
async function begin() {
  if (!(await loadData())) return;
  loading.finish();
  try {
    const greeting = await startSession();
    showUser();
    greet(greeting);
  } catch {
    addMessage('No pude conectarme con el servidor. Recarga la página en unos segundos.', 'bot');
  }
}
$('#loading-retry').addEventListener('click', begin);
begin();
