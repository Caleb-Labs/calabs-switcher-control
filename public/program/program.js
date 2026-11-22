import { connect } from '/shared/client.js';
import { createSourceElement, mountOnly, neededIds } from '/shared/sources.js';
import { syncGraphics, applyScale } from '/graphics/layer.js';

const FADE_MS = 500;
const stage = document.getElementById('stage');
const gfx = document.getElementById('gfx');
let sources = null;      // [{id, kind, url}] desde /api/sources
let lastState = null;
let lastSeq = 0;
let initialized = false;
let fading = false;
let fadeTimer = null;

const statusOf = (id) => lastState?.sources.find((s) => s.id === id)?.status ?? 'live';
const make = (id) => {
  const meta = sources.find((s) => s.id === id) ?? { id, kind: 'vdo' };
  return createSourceElement({ ...meta, status: statusOf(id) }, { url: meta.url });
};

function render(state) {
  syncGraphics(gfx, state, 'live');
  applyScale(gfx);
  if (!sources) return;
  const fresh = state.lastTake && state.lastTake.seq !== lastSeq;
  if (initialized && fresh && state.lastTake.mode === 'fade') {
    clearTimeout(fadeTimer);
    fading = true;
    mountOnly(stage, neededIds(state, true), make, statusOf);
    const incoming = stage.querySelector(`[data-source-id="${state.program}"]`);
    incoming.style.opacity = '0';
    incoming.style.zIndex = '2';
    requestAnimationFrame(() => requestAnimationFrame(() => { incoming.style.opacity = '1'; }));
    fadeTimer = setTimeout(() => {
      fading = false;
      mountOnly(stage, neededIds(lastState, false), make, statusOf);
    }, FADE_MS + 50);
  } else if (!fading) {
    mountOnly(stage, neededIds(state, false), make, statusOf);
  }
  lastSeq = state.lastTake?.seq ?? 0;
  initialized = true;
}

connect((state) => { lastState = state; render(state); });
fetch('/api/sources').then((r) => r.json()).then((list) => { sources = list; if (lastState) render(lastState); });
