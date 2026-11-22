import { renderGraphic } from './templates.js';
import { activeSlots, slotGcPlacement } from '../shared/split.js';
import { styleVars } from '../shared/gcstyle.js';

export const OUT_MS = 450; // duración de la animación de salida

const LIVE_DATA_TEMPLATES = new Set(['scoreboard', 'standings']); // usan los datos vivos del marcador

function wanted(state, which) {
  const out = [];
  for (const [id, g] of Object.entries(state.gc ?? {})) {
    if (g.state !== which) continue;
    const data = LIVE_DATA_TEMPLATES.has(g.template) ? { teams: state.scoreboard?.teams ?? [] } : g.data;
    const p = state.gcPos?.[id];
    const style = state.gcStyle?.[id === 'name' || id === 'score' ? id : null] ?? null;
    out.push({ id, template: g.template, data, pos: p ? { left: Math.round(p.x * 1920), top: Math.round(p.y * 1080) } : null, style, gk: style ? style.scale : null });
  }
  // GC de la pantalla dividida: uno por recuadro, en su lugar, con su propio texto.
  const splitShown = which === 'live' ? state.program === 'split' : state.preview === 'split' && state.program !== 'split';
  if (state.splitGc === which && splitShown && state.split) {
    const n = state.split.count;
    activeSlots(state).forEach((slot, i) => {
      const t = state.split.texts?.[n]?.[i];
      if (!t || (!t.title && !t.subtitle)) return;
      const place = slotGcPlacement(slot, state.split.gcOffs?.[n]?.[i] ?? { x: 0.03, y: 0.78 });
      const style = state.gcStyle?.split ?? null;
      out.push({ id: `split-gc-${i}`, template: 'gc-name', data: { team: t.title, player: t.subtitle }, pos: { left: place.left, top: place.top }, style, gk: Math.round(place.k * (style?.scale ?? 1) * 100) / 100 });
    });
  }
  if (state.vtr?.current === '@tabla') { // tabla a pantalla completa: sale por el VTR
    const onAir = state.program === 'vtr';
    if ((which === 'live' && onAir) || (which === 'preview' && state.preview === 'vtr' && !onAir)) {
      out.push({ id: 'vtr-standings', template: 'standings', data: { teams: state.scoreboard?.teams ?? [], full: true } });
    }
  }
  if (which === 'live' && state.emergency) out.push({ id: 'emergency', template: 'emergency', data: { logo: state.emergencyLogo, file: state.emergencyFile } });
  return out;
}

// Aplica a un nodo su posición, tamaño y estilo (se repite sin recrear el nodo, para no reiniciar su animación de entrada).
function updateNode(node, g) {
  if (g.pos) { node.style.left = `${g.pos.left}px`; node.style.top = `${g.pos.top}px`; node.style.bottom = 'auto'; }
  if (g.gk) node.style.setProperty('--gk', String(g.gk));
  if (g.style) {
    for (const [k, v] of Object.entries(styleVars(g.style))) node.style.setProperty(k, v);
    node.classList.toggle('has-tpl', !!g.style.template);
    if (g.style.template) node.style.setProperty('--gc-tpl', `url("/vtr/${encodeURIComponent(g.style.template)}")`);
    node.dataset.out = g.style.effectOut;
  }
}

function leave(node) {
  const out = node.dataset.out;
  node.dataset.leaving = '1';
  node.className = node.className.split(' ').filter((c) => !c.startsWith('fx-in-') && c !== 'in').join(' ');
  node.classList.add(`fx-out-${out}`);
  setTimeout(() => node.remove(), OUT_MS);
}

// Deja en `container` exactamente los gráficos del estado `which` ('preview' | 'live').
// No recrea elementos que no cambiaron (así no se reinician sus animaciones); los que se van salen con su efecto.
export function syncGraphics(container, state, which) {
  const list = wanted(state, which);
  const byId = new Map(list.map((g) => [g.id, g]));
  const keys = new Map(list.map((g) => [g.id, JSON.stringify([g.template, g.data])]));
  for (const child of [...container.children]) {
    const id = child.dataset.gcId;
    if (child.dataset.leaving) { if (byId.has(id)) child.remove(); continue; } // volvió a salir mientras se iba: se reemplaza por uno nuevo
    if (keys.get(id) === child.dataset.key) continue;
    const animated = !byId.has(id) && child.dataset.out && child.dataset.out !== 'none';
    if (animated) leave(child); else child.remove();
  }
  const present = new Set([...container.children].filter((c) => !c.dataset.leaving).map((c) => c.dataset.gcId));
  for (const g of list) {
    if (present.has(g.id)) { updateNode([...container.children].find((c) => c.dataset.gcId === g.id && !c.dataset.leaving), g); continue; }
    let node;
    try { node = renderGraphic(g.template, g.data); } catch { continue; } // un gráfico dañado no tumba a los demás
    node.dataset.gcId = g.id;
    node.dataset.key = keys.get(g.id);
    updateNode(node, g);
    const inFx = g.style?.effectIn;
    if (g.style) { if (inFx && inFx !== 'none') node.classList.add(`fx-in-${inFx}`); } else node.classList.add('in');
    container.append(node);
  }
  const em = [...container.children].find((c) => c.dataset.gcId === 'emergency');
  if (em && container.lastElementChild !== em) container.append(em);
}

// Escala el lienzo de gráficos (diseñado a 1920x1080) al ancho de su contenedor. Se escala el lienzo completo,
// no cada gráfico: así también se escalan las posiciones (left/top), que si no quedaban fuera de las ventanas chicas del panel.
export function applyScale(container) {
  container.style.width = '1920px';
  container.style.height = '1080px';
  container.style.transformOrigin = '0 0';
  const w = container.parentElement?.clientWidth;
  if (!w) return;
  const s = w / 1920;
  container.style.transform = s === 1 ? '' : `scale(${s})`;
}
