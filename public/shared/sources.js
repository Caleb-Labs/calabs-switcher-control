import { renderGraphic } from '../graphics/templates.js';
import { splitCamIds, splitBgFile, activeSlots } from './split.js';

// Montaje de fuentes. Regla clave: /program nunca mantiene montadas más fuentes de las necesarias
// (cada iframe de VDO.Ninja abre su propia conexión al jugador).

export function createSourceElement(source, { url } = {}) {
  if (source.kind === 'bg') { // fondo de la pantalla dividida: imagen o video
    const isVideo = /\.(mp4|webm|mov)$/i.test(url ?? '');
    const bg = document.createElement(isVideo ? 'video' : 'img');
    bg.dataset.sourceId = source.id;
    bg.className = 'src split-bg';
    if (isVideo) { bg.muted = true; bg.loop = true; bg.autoplay = true; bg.playsInline = true; }
    if (url) bg.setAttribute('src', url);
    return bg;
  }
  if (source.kind === 'split') { // vista esquemática (en /control); el compuesto real solo existe en /program
    const v = document.createElement('div');
    v.dataset.sourceId = source.id;
    v.className = 'src split-view';
    return v;
  }
  if (source.status === 'nosignal' && source.kind !== 'vtr') {
    const ns = renderGraphic('nosignal', {});
    ns.dataset.sourceId = source.id;
    ns.classList.add('src', 'nosignal-el');
    return ns;
  }
  const el = document.createElement(source.kind === 'vtr' ? 'video' : 'iframe');
  el.dataset.sourceId = source.id;
  el.dataset.kind = source.kind;
  el.className = 'src';
  if (source.kind === 'vtr') {
    el.playsInline = true;
  } else {
    el.setAttribute('allow', 'autoplay');
    if (url) el.setAttribute('src', url);
  }
  return el;
}

// Fuentes que deben existir en el DOM: la al aire y, durante un fade, la saliente.
// Ids de elementos que necesita una fuente: la dividida son sus cámaras + su fondo ('split-bg').
export function idsFor(state, id) {
  if (id !== 'split') return [id];
  return [...splitCamIds(state), ...(splitBgFile(state) ? ['split-bg'] : [])];
}

const uniq = (arr) => [...new Set(arr)];

// Cámaras que suenan: el audio master y las encendidas en el mezclador.
export function audibleCams(state) {
  // Con la pantalla dividida al aire y cámaras con audio elegido en sus recuadros, suena solo eso (el mezclador queda en pausa y vuelve al salir).
  if (state.program === 'split' && state.split?.audioOn) {
    const n = state.split.count;
    const picked = uniq(activeSlots(state).filter((_, i) => state.split.audioOn[n]?.[i]).map((s) => s.cam));
    if (picked.length) return picked;
  }
  return uniq([state.audioMaster, ...Object.entries(state.mix ?? {}).filter(([, m]) => m.on).map(([id]) => id)].filter(Boolean));
}

// Se montan: la al aire, la saliente (en fade), el preview y el audio master (estas dos ocultas): una conexión extra por jugador.
export function neededIds(state, fading) {
  const ids = [...idsFor(state, state.program)];
  if (fading && state.lastTake) ids.push(...idsFor(state, state.lastTake.from));
  if (state.preview) ids.push(...idsFor(state, state.preview)); // precarga (oculta) para que el CUT/FADE no muestre negro
  ids.push(...audibleCams(state));
  return uniq(ids);
}

// Lo que realmente se ve: la al aire y, durante un fade, la saliente. El resto va oculto (solo-audio/precarga).
export function visibleIds(state, fading) {
  const ids = [...idsFor(state, state.program)];
  if (fading && state.lastTake) ids.push(...idsFor(state, state.lastTake.from));
  return uniq(ids);
}

// Quita opacity/zIndex en línea que dejó un fade (si no, un fade de vuelta queda tapado y el audio-only se ve).
export function clearFadeStyles(container) {
  for (const el of container.children) { el.style.opacity = ''; el.style.zIndex = ''; }
}

// Volumen (0 o 1) que debe tener cada fuente en /program.
export function volumeFor(state, id) {
  const ch = state.audio?.[id === 'vtr' ? 'vtr' : 'cam'] ?? { level: 1, muted: false };
  const v = ch.muted ? 0 : ch.level;
  if (id === 'vtr') return state.program === 'vtr' && state.vtr?.playing ? v : 0;
  if (!audibleCams(state).includes(id)) return 0;
  return Math.round(v * (state.mix?.[id]?.level ?? 1) * 100) / 100;
}

// Aplica volúmenes sin recargar nada. VDO.Ninja: postMessage({volume}); Twitch: sin control (queda silenciado).
export function applyVolumes(container, volumeOf) {
  for (const el of container.children) {
    const v = volumeOf(el.dataset.sourceId);
    if (el.tagName === 'VIDEO') { if (el.dataset.metered) continue; el.muted = v === 0; el.volume = v; } // con medidor: el audio va solo al analizador
    else if (el.tagName === 'IFRAME' && el.dataset.kind === 'vdo') {
      el.contentWindow?.postMessage({ volume: v }, 'https://vdo.ninja');
    }
  }
}

export function markAudioOnly(container, visibleIds) {
  for (const el of container.children) el.classList.toggle('audio-only', !visibleIds.includes(el.dataset.sourceId));
}

// variantOf(id) distingue versiones del mismo id (p. ej. 'live' / 'nosignal'): si cambia, se reemplaza el elemento.
export function mountOnly(container, ids, create, variantOf = () => '') {
  for (const child of [...container.children]) {
    if (!ids.includes(child.dataset.sourceId) || child.dataset.variant !== variantOf(child.dataset.sourceId)) child.remove();
  }
  const present = new Set([...container.children].map((c) => c.dataset.sourceId));
  for (const id of ids) {
    if (present.has(id)) continue;
    const el = create(id);
    el.dataset.variant = variantOf(id);
    container.append(el);
  }
}

// Posiciona las cámaras de la pantalla dividida en su recuadro y limpia a las demás.
export function applyPlacement(container, placement) {
  for (const el of container.children) {
    const id = el.dataset.sourceId;
    const st = Object.hasOwn(placement, id) ? placement[id] : null;
    if (st) {
      el.style.left = st.left; el.style.top = st.top; el.style.width = st.width; el.style.height = st.height;
    } else {
      el.style.left = ''; el.style.top = ''; el.style.width = ''; el.style.height = '';
    }
    el.classList.toggle('split-cam', !!st);
  }
}
