// Qué área de la grilla ocupa cada fuente. Un solo iframe por fuente: no se duplica ni se mueve
// en el DOM (mover un iframe lo recarga), solo cambia su grid-area.
export function assignAreas(state) {
  const areas = {};
  for (const s of state.sources) {
    if (s.id === state.program) areas[s.id] = 'pgm';
    else if (s.id === state.preview) areas[s.id] = 'pre';
    else areas[s.id] = `s-${s.id}`;
  }
  return areas;
}

// --- Tamaños de las ventanas (ajustables por el operador) ---
// La grilla tiene 18 columnas de ancho --u; cada cámara chica ocupa 2 columnas y cada ventana grande `bigCols`.
export const DEFAULT_SIZES = { bigCols: 5, smallPx: 150 };

export function clampSizes(raw) {
  const num = (v, min, max, def) => {
    const n = Number(v);
    return Number.isFinite(n) && v !== null && v !== '' ? Math.min(max, Math.max(min, Math.round(n))) : def;
  };
  return {
    bigCols: num(raw?.bigCols, 4, 9, DEFAULT_SIZES.bigCols),
    smallPx: num(raw?.smallPx, 100, 260, DEFAULT_SIZES.smallPx),
  };
}

export function gridTemplate(ids, bigCols) {
  const top = [...Array(bigCols).fill('pre'), ...Array(bigCols).fill('pgm'), ...Array(18 - 2 * bigCols).fill('.')];
  const bottom = ids.flatMap((id) => [`s-${id}`, `s-${id}`]);
  return `"${top.join(' ')}" "${bottom.join(' ')}"`;
}

// Rótulo de las ventanas grandes: qué ventana es y qué fuente tiene.
export function badgeText(area, label) {
  if (area === 'pgm') return `PROGRAM · ${label}`;
  if (area === 'pre') return `PREVIEW · ${label}`;
  return '';
}
