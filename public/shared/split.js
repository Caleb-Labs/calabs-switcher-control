// Pantalla dividida: geometría y qué fuentes participan. Funciones puras (se prueban sin navegador).
const pct = (v) => `${Math.round(v * 10000) / 100}%`;

export const slotStyle = ({ x, y, w, h }) => ({ left: pct(x), top: pct(y), width: pct(w), height: pct(h) });

export const activeSlots = (state) => state.split?.layouts?.[state.split.count] ?? [];

// Cámaras (sin repetir) que usa el arreglo activo.
export const splitCamIds = (state) => [...new Set(activeSlots(state).map((s) => s.cam))];

export const splitBgFile = (state) => state.split?.bgs?.[state.split.count] ?? null;

// Estilos por cámara cuando la dividida está al aire (o saliendo en un fade). La cámara que entra a pantalla completa no se posiciona.
export function splitPlacement(state, fading) {
  const active = state.program === 'split' || (fading && state.lastTake?.from === 'split');
  if (!active) return {};
  const out = {};
  for (const slot of activeSlots(state)) {
    if (slot.cam === state.program || out[slot.cam]) continue;
    out[slot.cam] = slotStyle(slot);
  }
  return out;
}

// --- Geometría del editor (fracciones del lienzo) ---
const MIN = 0.05;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function moveRect(r, dx, dy) {
  return { ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) };
}

// Con `lock16x9` el alto sigue al ancho (en fracciones, w = h es 16:9 sobre un lienzo 16:9).
export function resizeRect(r, dw, dh, lock16x9) {
  if (lock16x9) {
    const w = clamp(r.w + dw, MIN, Math.min(1 - r.x, 1 - r.y));
    return { ...r, w, h: w };
  }
  return { ...r, w: clamp(r.w + dw, MIN, 1 - r.x), h: clamp(r.h + dh, MIN, 1 - r.y) };
}
