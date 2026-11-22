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
