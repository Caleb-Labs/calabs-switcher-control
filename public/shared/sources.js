import { renderGraphic } from '../graphics/templates.js';

// Montaje de fuentes. Regla clave: /program nunca mantiene montadas más fuentes de las necesarias
// (cada iframe de VDO.Ninja abre su propia conexión al jugador).

export function createSourceElement(source, { url } = {}) {
  if (source.status === 'nosignal' && source.kind !== 'vtr') {
    const ns = renderGraphic('nosignal', {});
    ns.dataset.sourceId = source.id;
    ns.classList.add('src', 'nosignal-el');
    return ns;
  }
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
