import {HarmonieEngine, inspectAudioFile, semitonesFor} from './harmonie-engine.mjs';

const $ = id => document.getElementById(id);
let mode = 'music';
let selectedFile = null;
let selectedMetadata = null;
let importGeneration = 0;
let importPending = false;
let actionPending = false;
let operationGeneration = 0;
const engine = new HarmonieEngine(render);
const time = value => `${Math.floor(Math.max(0, value) / 60)}:${String(Math.floor(Math.max(0, value) % 60)).padStart(2, '0')}`;
const numeral = number => new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 2}).format(number);

function showError(error) {
  $('error').textContent = error?.message || String(error);
  $('error').hidden = false;
}

function resetError() { $('error').hidden = true; $('error').textContent = ''; }

function updateFrequency() {
  if (mode === 'tone') {
    $('frequency-display').textContent = Number.isFinite($('tone-hz').valueAsNumber) ? numeral($('tone-hz').valueAsNumber) : '—';
    $('frequency-caption').textContent = 'Fréquence réglée · son pur';
  } else {
    const original = mode === 'music' && $('original').checked;
    $('frequency-display').textContent = original ? 'A/B' : '432';
    $('frequency-caption').textContent = original ? 'Hauteur du fichier d’origine' : 'La de référence visé';
  }
  try {
    const source = $('source-hz').valueAsNumber;
    const cents = semitonesFor(source) * 100;
    $('ratio-detail').textContent = `Source supposée : ${numeral(source)} Hz, non détectée. Décalage : ${numeral(cents)} cents. Tempo : × 1.`;
  } catch {
    $('ratio-detail').textContent = 'Indiquez un la de référence compris entre 400 et 480 Hz.';
  }
}

function render(snapshot = engine.snapshot()) {
  const playing = snapshot.state === 'playing';
  const paused = snapshot.state === 'paused';
  const loading = snapshot.state === 'loading';
  $('status').textContent = snapshot.message;
  const duration = snapshot.duration || (mode === 'music' ? selectedMetadata?.duration || 0 : Number($('duration').value));
  $('time').textContent = `${time(snapshot.position)} / ${time(duration)}`;
  $('progress').max = duration || 1;
  $('progress').value = snapshot.position || 0;
  $('play').disabled = playing || loading || actionPending || importPending || (mode === 'music' && !selectedFile);
  $('play').textContent = paused ? 'Reprendre' : loading ? 'Préparation…' : 'Écouter';
  $('pause').disabled = !playing || actionPending;
  $('stop').disabled = !playing && !paused && !loading;
  for (const id of ['source-hz','tone-hz','original','overlay','duration','overlay-level']) {
    $(id).disabled = playing || paused || loading || actionPending;
  }
  document.body.dataset.state = snapshot.state;
}

function cancelPendingAction() { operationGeneration++; actionPending = false; }

function selectMode(next) {
  cancelPendingAction();
  void engine.stop('Prêt. Aucun son n’est émis.');
  mode = next;
  for (const button of document.querySelectorAll('[data-mode]')) {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  for (const panel of document.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== mode;
  $('duration-panel').hidden = mode === 'music';
  $('overlay-panel').hidden = mode === 'tone';
  resetError(); updateFrequency(); render();
}

document.querySelectorAll('[data-mode]').forEach(button => {
  button.addEventListener('click', () => { if (button.dataset.mode !== mode) void selectMode(button.dataset.mode); });
});

$('audio-file').addEventListener('change', async event => {
  const generation = ++importGeneration;
  const file = event.target.files[0];
  cancelPendingAction();
  void engine.stop();
  selectedFile = null;
  selectedMetadata = null;
  importPending = Boolean(file);
  resetError();
  $('file-label').textContent = file ? 'Vérification du fichier…' : 'Choisir un fichier audio';
  $('file-detail').textContent = 'Mono ou stéréo · 25 Mo et 5 min maximum';
  render();
  try {
    if (!file) return;
    const metadata = await inspectAudioFile(file);
    if (generation !== importGeneration) return;
    selectedFile = file;
    selectedMetadata = metadata;
    $('file-label').textContent = metadata.name;
    $('file-detail').textContent = `${time(metadata.duration)} · ${numeral(metadata.bytes / 1024 / 1024)} Mo · prêt pour la lecture locale`;
  } catch (error) {
    if (generation === importGeneration) {
      $('file-label').textContent = 'Choisir un autre fichier audio';
      showError(error);
    }
  } finally {
    if (generation === importGeneration) { importPending = false; render(); }
  }
});

$('play').addEventListener('click', () => {
  if (actionPending) return;
  resetError();
  actionPending = true;
  const generation = ++operationGeneration;
  // Start/resume is invoked synchronously in the click handler for iOS.
  let operation;
  try {
    operation = engine.state === 'paused' ? engine.resume() : engine.start({
      mode, file: selectedFile,
      sourceHz: $('source-hz').valueAsNumber, targetHz: 432,
      original: $('original').checked,
      toneHz: $('tone-hz').valueAsNumber,
      duration: Number($('duration').value),
      volume: Number($('volume').value) / 100,
      overlay: $('overlay').checked,
      overlayLevel: Number($('overlay-level').value) / 100,
    });
  } catch (error) { operation = Promise.reject(error); }
  render();
  operation.catch(error => {
    if (generation === operationGeneration) showError(error);
  }).finally(() => {
    if (generation === operationGeneration) { actionPending = false; render(); }
  });
});

$('pause').addEventListener('click', () => { void engine.pause().catch(showError); });
$('stop').addEventListener('click', () => { cancelPendingAction(); void engine.stop().catch(showError); });
$('volume').addEventListener('input', () => {
  $('volume-value').textContent = `${$('volume').value} %`;
  engine.setVolume(Number($('volume').value) / 100);
});
$('overlay-level').addEventListener('input', () => { $('overlay-level-value').textContent = `${$('overlay-level').value} %`; });
$('overlay').addEventListener('change', () => { $('overlay-level-label').hidden = !$('overlay').checked; });
['tone-hz', 'source-hz', 'original'].forEach(id => $(id).addEventListener('input', updateFrequency));
$('duration').addEventListener('change', () => render());

document.addEventListener('visibilitychange', () => {
  if (document.hidden && engine.session) { cancelPendingAction(); void engine.stop('Lecture arrêtée : page passée en arrière-plan.'); }
});
window.addEventListener('pagehide', () => { void engine.stop(); });
// devicechange delivery varies by OS/browser; this is additional protection,
// not a claim to detect every headphone/Bluetooth disconnection.
navigator.mediaDevices?.addEventListener?.('devicechange', () => {
  if (engine.session) { cancelPendingAction(); void engine.stop('Sortie audio modifiée. Vérifiez le volume avant de reprendre.'); }
});

updateFrequency(); render();
// Test hook is read-only; it exposes no microphone, capture, file bytes or credentials.
Object.defineProperty(window, 'harmonieStatus', {get: () => engine.snapshot()});
