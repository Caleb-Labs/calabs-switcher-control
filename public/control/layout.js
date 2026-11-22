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

// --- Tamaño de las ventanas grandes: proporción del ancho de la ventana del navegador (el panel es fluido) ---
export const DEFAULT_SIZES = { bigShare: 0.33 };

export function clampSizes(raw) {
  const v = raw?.bigShare;
  const n = Number(v);
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return { ...DEFAULT_SIZES };
  return { bigShare: Math.round(Math.min(0.5, Math.max(0.2, n)) * 100) / 100 };
}

// La grilla tiene 2 columnas por fuente; cada ventana grande ocupa `share` del ancho (máximo la mitad).
export function bigColsFor(share, sourceCount) {
  return Math.min(sourceCount, Math.max(2, Math.round(share * 2 * sourceCount)));
}

export function gridTemplate(ids, bigCols) {
  const total = ids.length * 2;
  const top = [...Array(bigCols).fill('pre'), ...Array(bigCols).fill('pgm'), ...Array(total - 2 * bigCols).fill('.')];
  const bottom = ids.flatMap((id) => [`s-${id}`, `s-${id}`]);
  return `"${top.join(' ')}" "${bottom.join(' ')}"`;
}

// Rótulo de las ventanas grandes: qué ventana es y qué fuente tiene.
export function badgeText(area, label) {
  if (area === 'pgm') return `PROGRAM · ${label}`;
  if (area === 'pre') return `PREVIEW · ${label}`;
  return '';
}
