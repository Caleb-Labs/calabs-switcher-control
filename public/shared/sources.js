// Montaje de fuentes. Regla clave: /program nunca mantiene montadas más fuentes de las necesarias
// (cada iframe de VDO.Ninja abre su propia conexión al jugador).

export function createSourceElement(source, { url } = {}) {
  const el = document.createElement(source.kind === 'vtr' ? 'video' : 'iframe');
  el.dataset.sourceId = source.id;
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
export function neededIds(state, fading) {
  const ids = [state.program];
  if (fading && state.lastTake && state.lastTake.from !== state.program) ids.push(state.lastTake.from);
  return ids;
}

export function mountOnly(container, ids, create) {
  for (const child of [...container.children]) {
    if (!ids.includes(child.dataset.sourceId)) child.remove();
  }
  const present = new Set([...container.children].map((c) => c.dataset.sourceId));
  for (const id of ids) {
    if (!present.has(id)) container.append(create(id));
  }
}
