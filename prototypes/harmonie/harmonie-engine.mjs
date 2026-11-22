/* MUKTI · Harmonie. Local experimental browser engine.
 * No device-global capture, microphone, streaming-service access or network calls.
 * Signalsmith Stretch is bundled separately under its original MIT license.
 */

export const DEFAULT_REFERENCE_HZ = 432;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILE_SECONDS = 300;
export const MELODY = Object.freeze([
  {midi: 69, beats: 1.5}, {midi: 72, beats: .5},
  {midi: 76, beats: 1}, {midi: 74, beats: 1},
  {midi: 72, beats: 1}, {midi: 67, beats: .5},
  {midi: 64, beats: 1.5}, {midi: 69, beats: 1},
]);

export function semitonesFor(sourceHz, targetHz = DEFAULT_REFERENCE_HZ) {
  if (!Number.isFinite(sourceHz) || sourceHz < 400 || sourceHz > 480 ||
      !Number.isFinite(targetHz) || targetHz < 400 || targetHz > 480) {
    throw new Error('Le la de référence doit être compris entre 400 et 480 Hz.');
  }
  return 12 * Math.log2(targetHz / sourceHz);
}

export function melodyFrequency(midi, referenceHz = DEFAULT_REFERENCE_HZ) {
  return referenceHz * 2 ** ((midi - 69) / 12);
}

export function timeout(promise, label, milliseconds = 12000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

export function validateConfiguration(config) {
  if (!['music', 'tone', 'melody'].includes(config.mode)) throw new Error('Mode audio inconnu.');
  if (!Number.isFinite(config.volume) || config.volume < 0 || config.volume > .25) {
    throw new Error('Le niveau numérique doit rester compris entre 0 et 25 %.');
  }
  if (config.mode === 'music') {
    semitonesFor(config.sourceHz, config.targetHz);
    if (!config.file || !Number.isFinite(config.file.size) || config.file.size <= 0 || config.file.size > MAX_FILE_BYTES) {
      throw new Error('Choisir un fichier audio local de 25 Mo maximum.');
    }
    if (config.file.type?.startsWith('video/')) throw new Error('Cette version du lecteur accepte les fichiers audio uniquement.');
  } else {
    if (![60, 180, 300, 600].includes(config.duration)) throw new Error('Choisir une durée de 1, 3, 5 ou 10 minutes.');
    if (config.mode === 'tone' && (!Number.isFinite(config.toneHz) || config.toneHz < 100 || config.toneHz > 2000)) {
      throw new Error('Choisir une fréquence comprise entre 100 et 2 000 Hz.');
    }
  }
  if (!Number.isFinite(config.overlayLevel) || config.overlayLevel < 0 || config.overlayLevel > .4) {
    throw new Error('Le niveau relatif de la tonalité doit rester compris entre 0 et 40 %.');
  }
}

export async function inspectAudioFile(file) {
  if (!file || file.size <= 0 || file.size > MAX_FILE_BYTES || file.type.startsWith('video/')) {
    throw new Error('Choisir un fichier audio local de 25 Mo maximum. Les vidéos ne sont pas prises en charge ici.');
  }
  const audio = new Audio();
  const url = URL.createObjectURL(file);
  try {
    const duration = await timeout(new Promise((resolve, reject) => {
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => reject(new Error('Ce navigateur ne sait pas lire ce format audio.'));
      audio.src = url;
      audio.load();
    }), 'Le format audio n’a pas pu être reconnu.', 10000);
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_FILE_SECONDS) {
      throw new Error('Ce prototype accepte les fichiers dont la durée est connue et ne dépasse pas 5 minutes.');
    }
    return {name: file.name, duration, bytes: file.size};
  } finally {
    audio.onloadedmetadata = null;
    audio.onerror = null;
    audio.removeAttribute('src');
    audio.load();
    URL.revokeObjectURL(url);
  }
}

function disconnect(node) {
  try { node?.disconnect(); } catch { /* Already disconnected. */ }
}

function holdAndRamp(param, now, value, seconds = .03) {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
  else {
    const current = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
  }
  param.linearRampToValueAtTime(value, now + seconds);
}

export class HarmonieEngine {
  constructor(onChange = () => {}) {
    this.onChange = onChange;
    this.session = null;
    this.generation = 0;
    this.state = 'idle';
    this.message = 'Prêt. Aucun son n’est émis.';
  }

  snapshot() {
    const s = this.session;
    return {
      state: this.state,
      message: this.message,
      mode: s?.config.mode ?? null,
      position: s ? Math.max(0, Math.min(s.duration || 0, s.context.currentTime - (s.startAt || 0))) : 0,
      duration: s?.duration ?? 0,
      latency: s?.latency ?? 0,
      sampleRate: s?.context.sampleRate ?? null,
    };
  }

  report(state, message) {
    this.state = state;
    this.message = message;
    this.onChange(this.snapshot());
  }

  async disposeSession(session, fade = false) {
    if (!session) return;
    clearInterval(session.tick);
    clearInterval(session.melodyTick);
    clearTimeout(session.endTimer);
    if (fade && session.gain && session.context.state === 'running') {
      holdAndRamp(session.gain.gain, session.context.currentTime, 0);
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    session.sources?.forEach(source => { try { source.stop(); } catch { /* Already stopped. */ } });
    session.sources?.clear();
    disconnect(session.node);
    disconnect(session.gain);
    session.node?.port?.close();
    session.context.onstatechange = null;
    if (session.context.state !== 'closed') await session.context.close().catch(() => {});
  }

  async stop(message = 'Arrêté. Aucun son n’est émis.') {
    this.generation++;
    const previous = this.session;
    this.session = null;
    this.report('stopped', message);
    await this.disposeSession(previous, true);
  }

  async start(config) {
    validateConfiguration(config);
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) throw new Error('Web Audio n’est pas disponible dans ce navigateur.');
    // Both construction and resume happen before the first await: iOS user gesture.
    const context = new Ctx({latencyHint: 'playback'});
    const resume = context.resume();
    void resume.catch(() => {}); // Attach immediately while a prior session fades.
    const previous = this.session;
    const generation = ++this.generation;
    const session = {context, config: {...config}, sources: new Set(), duration: 0, latency: 0};
    this.session = session;
    this.report('loading', 'Préparation du son sur cet appareil…');
    const current = () => this.generation === generation && this.session === session;
    try {
      await this.disposeSession(previous, true);
      await timeout(resume, 'La sortie audio n’a pas pu démarrer. Touchez à nouveau Écouter.');
      if (!current()) return await this.disposeSession(session);
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(context.destination);
      session.gain = gain;

      if (config.mode === 'music') {
        await inspectAudioFile(config.file); // Guard duration before decoding large data.
        if (!current()) return await this.disposeSession(session);
        const raw = await config.file.arrayBuffer();
        if (!current()) return await this.disposeSession(session);
        const decoded = await timeout(context.decodeAudioData(raw), 'Le décodage du fichier a échoué ou a pris trop de temps.', 20000);
        if (!current()) return await this.disposeSession(session);
        if (decoded.duration > MAX_FILE_SECONDS || decoded.numberOfChannels < 1 || decoded.numberOfChannels > 2) {
          throw new Error('Ce prototype accepte les fichiers mono ou stéréo de 5 minutes maximum.');
        }
        session.duration = decoded.duration;
        const source = context.createBufferSource();
        source.buffer = decoded;
        source.playbackRate.value = 1;
        session.sources.add(source);
        source.onended = () => { session.sources.delete(source); disconnect(source); };
        const shift = config.original ? 0 : semitonesFor(config.sourceHz, config.targetHz);
        if (shift === 0) {
          // Exact bypass: already-432 and original comparison are never shifted.
          source.connect(gain);
        } else {
          if (!globalThis.isSecureContext || !context.audioWorklet || !globalThis.SignalsmithStretch) {
            throw new Error('Le réaccordage demande AudioWorklet et une ouverture en HTTPS ou localhost.');
          }
          const nodePromise = globalThis.SignalsmithStretch(context, {
            numberOfInputs: 1, numberOfOutputs: 1,
            outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit',
          });
          // The vendor promise does not reject every initialization failure.
          const node = await timeout(nodePromise, 'Le moteur audio n’a pas répondu. Réessayez sur un navigateur compatible.');
          session.node = node;
          if (!current()) return await this.disposeSession(session);
          node.addEventListener('processorerror', () => {
            if (current()) void this.stop('Le moteur audio s’est interrompu. Aucun son n’est émis.');
          });
          // Live input avoids the upstream buffer-seek pitch error measured in
          // tests. Longer windows improve spectral analysis; cost: 320 ms DSP delay.
          await timeout(node.configure({blockMs: 320, intervalMs: 80}), 'La configuration du moteur a échoué.');
          if (!current()) return await this.disposeSession(session);
          session.latency = await timeout(node.latency(), 'La latence du moteur n’a pas pu être obtenue.');
          if (!current()) return await this.disposeSession(session);
          await timeout(node.schedule({
            active: true, rate: 1, semitones: shift,
            tonalityHz: 0, formantCompensation: false,
          }), 'Le moteur audio n’a pas confirmé le démarrage.');
          if (!current()) return await this.disposeSession(session);
          // Keep a live zero-valued input through the DSP tail. Without this,
          // upstream switches to buffer mode when the last source ends, cutting
          // part of the final 320 ms. This is silence, not an added tone.
          const keepAlive = context.createConstantSource();
          keepAlive.offset.value = 0;
          keepAlive.connect(node);
          session.sources.add(keepAlive);
          keepAlive.onended = () => { session.sources.delete(keepAlive); disconnect(keepAlive); };
          keepAlive.start();
          source.connect(node).connect(gain);
        }
        const sourceStartAt = context.currentTime + .04;
        session.startAt = sourceStartAt + session.latency;
        source.start(sourceStartAt);
      } else {
        session.duration = config.duration;
        session.startAt = context.currentTime + .04;
        if (config.mode === 'tone') this.addTone(session, config.toneHz, .25);
        else this.startMelody(session);
      }

      if (!current()) return await this.disposeSession(session);
      if (config.overlay && config.mode !== 'tone') this.addTone(session, 432, .25 * config.overlayLevel);
      this.scheduleVolume(session);
      session.tick = setInterval(() => {
        if (!current()) return;
        if (context.currentTime >= session.startAt + session.duration) {
          void this.stop('Séance terminée. Aucun son n’est émis.');
        } else this.onChange(this.snapshot());
      }, 100);
      context.onstatechange = () => {
        if (current() && this.state === 'playing' && context.state !== 'running') {
          // An OS interruption must not silently resume with stale UI state.
          // Explicit user Pause is handled separately, before context.suspend().
          void this.stop('Audio interrompu : écoute arrêtée. Touchez Écouter pour relancer.');
        }
      };
      const message = config.mode === 'music'
        ? (config.original ? 'Comparaison : hauteur d’origine, tempo conservé.' : `Réaccordage déclaré ${config.sourceHz} → ${config.targetHz} Hz. Tempo conservé.`)
        : config.mode === 'tone' ? `Tonalité seule : ${config.toneHz} Hz.`
          : `Mélodie accordée au la 432 Hz${config.overlay ? ' + tonalité continue 432 Hz' : ''}.`;
      this.report('playing', message);
    } catch (error) {
      await this.disposeSession(session);
      if (current()) {
        this.session = null;
        this.report('error', error.message || 'Le son n’a pas pu démarrer.');
        throw error;
      }
      // A stopped or replaced asynchronous start must not surface a stale error.
    }
  }

  scheduleVolume(session) {
    const {context, gain, config, startAt, duration} = session;
    const now = context.currentTime;
    const endAt = startAt + duration;
    if (endAt <= now + .04) return;
    holdAndRamp(gain.gain, now, config.volume, .04);
    if (now < startAt) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(config.volume, startAt + .04);
    }
    // This fade is scheduled on the audio clock, so background timer throttling
    // cannot leave the output sounding past the chosen end time.
    gain.gain.setValueAtTime(config.volume, Math.max(now + .04, endAt - .06));
    gain.gain.linearRampToValueAtTime(0, endAt);
  }

  setVolume(volume) {
    if (!Number.isFinite(volume) || volume < 0 || volume > .25) return;
    if (this.session) {
      this.session.config.volume = volume;
      if (this.state === 'playing') this.scheduleVolume(this.session);
    }
  }

  addTone(session, hz, amplitude) {
    const {context, startAt, duration, gain} = session;
    const oscillator = context.createOscillator();
    const level = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = hz;
    level.gain.value = amplitude;
    oscillator.connect(level).connect(gain);
    session.sources.add(oscillator);
    oscillator.onended = () => { session.sources.delete(oscillator); disconnect(oscillator); disconnect(level); };
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  }

  startMelody(session) {
    const {context, startAt, duration, gain} = session;
    const beat = 60 / 72;
    let nextAt = startAt;
    let noteIndex = 0;
    const schedule = () => {
      if (this.session !== session) return;
      while (nextAt < context.currentTime + .6 && nextAt < startAt + duration - .05) {
        const note = MELODY[noteIndex++ % MELODY.length];
        const noteSeconds = note.beats * beat;
        const plannedStart = nextAt;
        nextAt += noteSeconds;
        // Skip missed notes after a stalled scheduler. Never stack all missed
        // oscillators at currentTime; that could produce an unexpected peak.
        if (plannedStart < context.currentTime - .025) continue;
        const start = Math.max(plannedStart, context.currentTime + .01);
        const end = Math.min(plannedStart + noteSeconds * .94, startAt + duration);
        if (end > start + .04) {
          const osc = context.createOscillator();
          const level = context.createGain();
          osc.type = 'sine';
          osc.frequency.value = melodyFrequency(note.midi);
          level.gain.setValueAtTime(0, start);
          level.gain.linearRampToValueAtTime(.25, start + .03);
          level.gain.exponentialRampToValueAtTime(.025, end - .02);
          level.gain.linearRampToValueAtTime(0, end);
          osc.connect(level).connect(gain);
          session.sources.add(osc);
          osc.onended = () => {session.sources.delete(osc); disconnect(osc); disconnect(level);};
          osc.start(start);
          osc.stop(end + .01);
        }
      }
    };
    schedule();
    session.melodyTick = setInterval(schedule, 100);
  }

  async pause() {
    const session = this.session;
    if (!session || this.state !== 'playing') return;
    holdAndRamp(session.gain.gain, session.context.currentTime, 0);
    this.report('paused', 'En pause.');
    await new Promise(resolve => setTimeout(resolve, 40));
    if (this.session === session && this.state === 'paused') await session.context.suspend();
  }

  async resume() {
    const session = this.session;
    if (!session || this.state !== 'paused') return;
    // Called directly by a click, before any other asynchronous operation.
    const resumed = session.context.resume();
    await timeout(resumed, 'La sortie audio ne répond pas.');
    if (this.session !== session) return;
    this.scheduleVolume(session);
    this.report('playing', 'Lecture reprise.');
  }
}
