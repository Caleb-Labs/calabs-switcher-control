import { connect } from '/shared/client.js';
import { createSourceElement, mountOnly, neededIds, visibleIds, idsFor, applyPlacement, clearFadeStyles, volumeFor, applyVolumes, markAudioOnly } from '/shared/sources.js';
import { splitBgFile, splitPlacement } from '/shared/split.js';
import { syncGraphics, applyScale } from '/graphics/layer.js';
import { syncVtr } from '/shared/vtr.js';

const stage = document.getElementById('stage');
const gfx = document.getElementById('gfx');
let sources = null;      // [{id, kind, url}] desde /api/sources
let lastState = null;
let lastSeq = 0;
let lastTone = null;
let initialized = false;
let fading = false;
let fadeTimer = null;

const statusOf = (id) => lastState?.sources.find((s) => s.id === id)?.status ?? 'live';
const variantOf = (id) => (id === 'split-bg' ? (lastState && splitBgFile(lastState)) ?? '' : statusOf(id));
const make = (id) => {
  if (id === 'split-bg') return createSourceElement({ id, kind: 'bg' }, { url: `/vtr/${encodeURIComponent(splitBgFile(lastState))}` });
  const meta = sources.find((s) => s.id === id) ?? { id, kind: 'vdo' };
  return createSourceElement({ ...meta, status: statusOf(id) }, { url: meta.url });
};
const find = (id) => stage.querySelector(`[data-source-id="${id}"]`);

function renderStage(state) {
  const fresh = initialized && state.lastTake && state.lastTake.seq !== lastSeq;
  if (fresh) { clearTimeout(fadeTimer); fading = false; clearFadeStyles(stage); } // una toma nueva cancela el fade en curso
  if (fresh && state.lastTake.mode === 'fade') {
    fading = true;
    mountOnly(stage, neededIds(state, true), make, variantOf);
    markAudioOnly(stage, visibleIds(state, true));
    applyPlacement(stage, splitPlacement(state, true));
    // Entran con fade solo los elementos nuevos; los que ya estaban visibles (cámara que pasa de la dividida a sola) no parpadean.
    const outgoing = new Set(idsFor(state, state.lastTake.from));
    const incoming = idsFor(state, state.program).filter((id) => !outgoing.has(id)).map(find).filter(Boolean);
    const ms = state.lastTake.ms || 500;
    for (const el of incoming) {
      el.style.zIndex = el.classList.contains('split-cam') ? '4' : '3';
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'linear' }); // Web Animations: no depende de transiciones CSS ni de rAF
    }
    fadeTimer = setTimeout(() => {
      fading = false;
      clearFadeStyles(stage);
      mountOnly(stage, neededIds(lastState, false), make, variantOf);
      markAudioOnly(stage, visibleIds(lastState, false));
      applyPlacement(stage, splitPlacement(lastState, false));
    }, ms + 50);
  } else {
    mountOnly(stage, neededIds(state, fading), make, variantOf);
    markAudioOnly(stage, visibleIds(state, fading));
    applyPlacement(stage, splitPlacement(state, fading));
  }
  const vtrEl = find('vtr');
  if (vtrEl?.tagName === 'VIDEO') syncVtr(vtrEl, state.vtr);
  applyVolumes(stage, (id) => volumeFor(state, id));
  lastSeq = state.lastTake?.seq ?? 0;
  initialized = true;
}

// Bip de prueba: comprueba que el audio de esta página llega a OBS (independiente de cámaras y VTR).
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume?.();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 440;
    gain.gain.value = 0.25;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
    setTimeout(() => ctx.close(), 1200);
  } catch (e) { console.error('bip:', e); }
}

function render(state) {
  if (lastTone !== null && state.toneSeq !== lastTone) beep();
  lastTone = state.toneSeq;
  if (sources) renderStage(state); // primero la imagen: un gráfico dañado nunca debe congelar el switch
  try {
    syncGraphics(gfx, state, 'live');
    applyScale(gfx);
  } catch (e) { console.error('gráficos:', e); }
}

// Los iframes recién cargados o recién conectados necesitan recibir su volumen otra vez.
const reapplyVolumes = () => { if (lastState) applyVolumes(stage, (id) => volumeFor(lastState, id)); };
stage.addEventListener('load', reapplyVolumes, true);
window.addEventListener('message', (e) => { if (e.origin === 'https://vdo.ninja' && e.data?.action === 'view-connection') reapplyVolumes(); });
setInterval(reapplyVolumes, 2000);

connect((state) => { lastState = state; render(state); });
fetch('/api/sources').then((r) => r.json()).then((list) => { sources = list; if (lastState) render(lastState); });
