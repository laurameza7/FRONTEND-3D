/*
 * Coopi's voice with the browser's Web Speech API:
 *  - Recognition (SpeechRecognition, Colombian Spanish).
 *  - "Ey Coopi" mode: listens in the background and activates when it hears "ey / oye / hey Coopi ...".
 *  - Synthesis (speechSynthesis) so Coopi answers out loud.
 */
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const WAKE_WORD = /^(?:(?:ey|oye|hey|ei|hei|ay|okey|ok|hola)\s+)?(?:coopi|copi|kopi|cupi|coopy|coopie|cooppi|kuppi|cuppy|coby|copy)\b[\s,.:]*/i;

/**
 * Navigation orders ("llévame a…", "quiero ir a…", "muéstrame…", "¿dónde queda…?"). In hands-free mode they are
 * understood right away, without saying "Ey Coopi" first, so the visitor is taken there with no clicks.
 */
export const GO_COMMAND = /^[¿¡\s]*(?:por favor,?\s+)?(?:ll[eé]v[ae]me|ll[eé]vanos|quiero (?:ir|ver|entrar)|mu[eé]strame|mu[eé]strenme|ens[eé]ñame|vamos (?:a|al|para)|d[oó]nde (?:queda|est[aá]|es)|c[oó]mo (?:llego|voy)|ub[ií]came|gu[ií]ame|ir a|ir al|entrar a|entrar al)(?=\s|$)/i;

export class Voice {
  constructor({ onQuestion, onActivate, onStatus }) {
    this.onQuestion = onQuestion;      // (text) => void
    this.onActivate = onActivate;      // () => void  (only said "ey Coopi")
    this.onStatus = onStatus;            // ('listening' | 'waiting' | 'off' | 'error', detail)
    this.canListen = Boolean(Recognition);
    this.canSpeak = 'speechSynthesis' in window;
    this.speechOn = this.canSpeak;
    this.wakeMode = false;              // background listening with "Ey Coopi"
    this.waitingForQuestion = false;      // already said "Ey Coopi", the next sentence is the question
    this.speaking = false;
    this.oneShot = false;                // the next sentence comes from the microphone button
    this.rec = null;
    if (this.canSpeak) speechSynthesis.onvoiceschanged = () => (this.spanishVoice = null);
  }

  /* ---------------------------------------------------------------- listen */
  #create(continuous) {
    const rec = new Recognition();
    rec.lang = 'es-CO';
    rec.continuous = continuous;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const r = ev.results[ev.results.length - 1];
      if (r.isFinal) this.#hear(r[0].transcript.trim());
    };
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        this.wakeMode = false;
        this.onStatus?.('error', 'Permite el micrófono en el navegador para hablar con Coopi.');
      }
    };
    rec.onend = () => {
      this.rec = null;
      if (this.wakeMode && !this.speaking) setTimeout(() => this.#listenInBackground(), 250);
      else if (!this.wakeMode) this.onStatus?.('off');
    };
    return rec;
  }

  #hear(text) {
    if (!text || this.speaking) return;
    if (!this.wakeMode || this.oneShot) {       // microphone button: everything said is the question
      this.oneShot = false;
      this.onQuestion?.(text.replace(WAKE_WORD, '').trim() || text);
      return;
    }
    const m = text.match(WAKE_WORD);
    if (m) {
      const rest = text.slice(m[0].length).trim();
      if (rest.split(' ').length >= 2) { this.waitingForQuestion = false; this.onQuestion?.(rest); }
      else { this.waitingForQuestion = true; this.onActivate?.(); this.onStatus?.('waiting'); }
    } else if (this.waitingForQuestion) {
      this.waitingForQuestion = false;
      this.onQuestion?.(text);
    } else if (GO_COMMAND.test(text)) {       // "llévame a la facultad de ingeniería": no wake word needed
      this.onQuestion?.(text);
    }
  }

  /** Microphone button: listens to a single sentence. */
  listenOnce() {
    if (!this.canListen) return false;
    this.stop();
    this.stopSpeaking();
    this.rec = this.#create(false);
    this.oneShot = true;
    try { this.rec.start(); this.onStatus?.('listening'); } catch { /* it was already listening */ }
    return true;
  }

  /** Turns background listening with the word "Ey Coopi" on or off. */
  wakeWord(activate) {
    if (!this.canListen) return false;
    this.wakeMode = activate;
    this.waitingForQuestion = false;
    if (activate) this.#listenInBackground();
    else this.stop();
    return activate;
  }

  #listenInBackground() {
    if (!this.wakeMode || this.rec || this.speaking) return;
    this.rec = this.#create(true);
    this.oneShot = false;
    try { this.rec.start(); this.onStatus?.(this.waitingForQuestion ? 'waiting' : 'wake'); } catch { this.rec = null; }
  }

  stop() {
    const r = this.rec;
    this.rec = null;
    if (r) { r.onend = null; try { r.abort(); } catch { /* nothing */ } }
    if (!this.wakeMode) this.onStatus?.('off');
  }

  /* ---------------------------------------------------------------- speak */
  #voice() {
    if (this.spanishVoice) return this.spanishVoice;
    const voices = speechSynthesis.getVoices();
    this.spanishVoice = voices.find(v => /es[-_](CO|419|MX|US)/i.test(v.lang))
      || voices.find(v => /^es/i.test(v.lang)) || null;
    return this.spanishVoice;
  }

  speak(text) {
    if (!this.canSpeak || !this.speechOn || !text) return;
    speechSynthesis.cancel();
    // Emojis and links are left out so it sounds natural
    const clean = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/https?:\/\/\S+/g, '').slice(0, 600);
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'es-CO';
    u.voice = this.#voice();
    u.rate = 1.03;
    // While Coopi speaks it does not listen, so it does not hear itself
    const resume = () => {
      this.speaking = false;
      if (this.wakeMode) setTimeout(() => this.#listenInBackground(), 300);
    };
    u.onstart = () => { this.speaking = true; const r = this.rec; this.rec = null; if (r) { r.onend = null; try { r.abort(); } catch { /* */ } } };
    u.onend = resume;
    u.onerror = resume;
    speechSynthesis.speak(u);
  }

  stopSpeaking() {
    if (this.canSpeak) speechSynthesis.cancel();
    this.speaking = false;
  }
}
