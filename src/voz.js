/*
 * Voz de Coopi con la Web Speech API del navegador:
 *  - Reconocimiento (SpeechRecognition, español de Colombia).
 *  - Modo "Ey Coopi": escucha de fondo y se activa al oír "ey / oye / hey Coopi ...".
 *  - Síntesis (speechSynthesis) para que Coopi responda en voz alta.
 */
const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
export const ACTIVACION = /^(?:(?:ey|oye|hey|ei|hei|ay|okey|ok|hola)\s+)?(?:coopi|copi|kopi|cupi|coopy|coopie|cooppi|kuppi|cuppy|coby|copy)\b[\s,.:]*/i;

export class Voz {
  constructor({ alPreguntar, alActivarse, alEstado }) {
    this.alPreguntar = alPreguntar;      // (texto) => void
    this.alActivarse = alActivarse;      // () => void  (dijo solo "ey Coopi")
    this.alEstado = alEstado;            // ('escuchando' | 'esperando' | 'apagado' | 'error', detalle)
    this.puedeEscuchar = Boolean(Reconocimiento);
    this.puedeHablar = 'speechSynthesis' in window;
    this.hablarActivo = this.puedeHablar;
    this.modoClave = false;              // escucha de fondo con "Ey Coopi"
    this.esperandoPregunta = false;      // ya dijo "Ey Coopi", la próxima frase es la pregunta
    this.hablando = false;
    this.rec = null;
    if (this.puedeHablar) speechSynthesis.onvoiceschanged = () => (this.vozEs = null);
  }

  /* ---------------------------------------------------------------- escuchar */
  #crear(continuo) {
    const rec = new Reconocimiento();
    rec.lang = 'es-CO';
    rec.continuous = continuo;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const r = ev.results[ev.results.length - 1];
      if (r.isFinal) this.#oir(r[0].transcript.trim());
    };
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        this.modoClave = false;
        this.alEstado?.('error', 'Permite el micrófono en el navegador para hablar con Coopi.');
      }
    };
    rec.onend = () => {
      this.rec = null;
      if (this.modoClave && !this.hablando) setTimeout(() => this.#escucharFondo(), 250);
      else if (!this.modoClave) this.alEstado?.('apagado');
    };
    return rec;
  }

  #oir(texto) {
    if (!texto || this.hablando) return;
    if (!this.modoClave) {                       // botón del micrófono: todo lo que diga es la pregunta
      this.alPreguntar?.(texto.replace(ACTIVACION, '').trim() || texto);
      return;
    }
    const m = texto.match(ACTIVACION);
    if (m) {
      const resto = texto.slice(m[0].length).trim();
      if (resto.split(' ').length >= 2) { this.esperandoPregunta = false; this.alPreguntar?.(resto); }
      else { this.esperandoPregunta = true; this.alActivarse?.(); this.alEstado?.('esperando'); }
    } else if (this.esperandoPregunta) {
      this.esperandoPregunta = false;
      this.alPreguntar?.(texto);
    }
  }

  /** Botón del micrófono: escucha una sola frase. */
  escucharUnaVez() {
    if (!this.puedeEscuchar) return false;
    this.detener();
    this.callar();
    this.rec = this.#crear(false);
    try { this.rec.start(); this.alEstado?.('escuchando'); } catch { /* ya estaba escuchando */ }
    return true;
  }

  /** Activa o desactiva la escucha de fondo con la palabra "Ey Coopi". */
  palabraClave(activar) {
    if (!this.puedeEscuchar) return false;
    this.modoClave = activar;
    this.esperandoPregunta = false;
    if (activar) this.#escucharFondo();
    else this.detener();
    return activar;
  }

  #escucharFondo() {
    if (!this.modoClave || this.rec || this.hablando) return;
    this.rec = this.#crear(true);
    try { this.rec.start(); this.alEstado?.(this.esperandoPregunta ? 'esperando' : 'clave'); } catch { this.rec = null; }
  }

  detener() {
    const r = this.rec;
    this.rec = null;
    if (r) { r.onend = null; try { r.abort(); } catch { /* nada */ } }
    if (!this.modoClave) this.alEstado?.('apagado');
  }

  /* ---------------------------------------------------------------- hablar */
  #voz() {
    if (this.vozEs) return this.vozEs;
    const voces = speechSynthesis.getVoices();
    this.vozEs = voces.find(v => /es[-_](CO|419|MX|US)/i.test(v.lang))
      || voces.find(v => /^es/i.test(v.lang)) || null;
    return this.vozEs;
  }

  hablar(texto) {
    if (!this.puedeHablar || !this.hablarActivo || !texto) return;
    speechSynthesis.cancel();
    // Se dejan por fuera emojis y enlaces para que suene natural
    const limpio = texto.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/https?:\/\/\S+/g, '').slice(0, 600);
    const u = new SpeechSynthesisUtterance(limpio);
    u.lang = 'es-CO';
    u.voice = this.#voz();
    u.rate = 1.03;
    // Mientras Coopi habla no se escucha, para que no se oiga a sí mismo
    const reanudar = () => {
      this.hablando = false;
      if (this.modoClave) setTimeout(() => this.#escucharFondo(), 300);
    };
    u.onstart = () => { this.hablando = true; const r = this.rec; this.rec = null; if (r) { r.onend = null; try { r.abort(); } catch { /* */ } } };
    u.onend = reanudar;
    u.onerror = reanudar;
    speechSynthesis.speak(u);
  }

  callar() {
    if (this.puedeHablar) speechSynthesis.cancel();
    this.hablando = false;
  }
}
