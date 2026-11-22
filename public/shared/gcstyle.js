// Estilo de los GC: colores, tamaño, plantilla, efectos y salida automática. Funciones puras (cliente y servidor).
export const DEFAULT_STYLE = Object.freeze({
  bg: '#1c1f25', bgAlpha: 0.93, text: '#e4e6ea', sub: '#aeb4bf', accent: '#6f8fb0',
  scale: 1, template: null, effectIn: 'fade', effectOut: 'fade', autoHide: 0,
});
export const IN_EFFECTS = ['none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'zoom', 'typewriter'];
export const OUT_EFFECTS = ['none', 'fade', 'slide-left', 'slide-right', 'slide-down', 'zoom'];
export const STYLE_TARGETS = ['name', 'split', 'score'];

const HEX = /^#[0-9a-fA-F]{6}$/;
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => Math.round(v * 100) / 100;

const VALIDATORS = {
  bg: (v) => (typeof v === 'string' && HEX.test(v) ? v : undefined),
  text: (v) => (typeof v === 'string' && HEX.test(v) ? v : undefined),
  sub: (v) => (typeof v === 'string' && HEX.test(v) ? v : undefined),
  accent: (v) => (typeof v === 'string' && HEX.test(v) ? v : undefined),
  bgAlpha: (v) => (num(v) && v >= 0 && v <= 1 ? round2(v) : undefined),
  scale: (v) => (num(v) && v >= 0.3 && v <= 3 ? round2(v) : undefined),
  effectIn: (v) => (IN_EFFECTS.includes(v) ? v : undefined),
  effectOut: (v) => (OUT_EFFECTS.includes(v) ? v : undefined),
  autoHide: (v) => (Number.isInteger(v) && v >= 0 && v <= 600 ? v : undefined),
  template: (v) => (v === null || typeof v === 'string' ? v : undefined),
};

// Devuelve el estilo con los cambios aplicados, o null si hay algún campo desconocido o inválido.
export function patchStyle(style, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return null;
  const out = { ...style };
  for (const [k, v] of Object.entries(patch)) {
    if (!Object.hasOwn(VALIDATORS, k)) return null;
    const clean = VALIDATORS[k](v);
    if (clean === undefined) return null;
    out[k] = clean;
  }
  return out;
}

// Repara un estilo leído del disco: cada campo inválido vuelve a su valor por defecto.
export function cleanStyle(raw) {
  let s = { ...DEFAULT_STYLE };
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) { const p = patchStyle(s, { [k]: v }); if (p) s = p; }
  }
  return s;
}

export function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function styleVars(style) {
  return {
    '--gc-bg': hexToRgba(style.bg, style.bgAlpha),
    '--gc-text': style.text,
    '--gc-sub': style.sub,
    '--gc-accent': style.accent,
    '--gc-scale': String(style.scale),
  };
}
