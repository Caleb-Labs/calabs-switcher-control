import { renderGraphic } from './templates.js';

const LIVE_DATA_TEMPLATES = new Set(['scoreboard', 'standings']); // usan los datos vivos del marcador

function wanted(state, which) {
  const out = [];
  for (const [id, g] of Object.entries(state.gc ?? {})) {
    if (g.state !== which) continue;
    const data = LIVE_DATA_TEMPLATES.has(g.template) ? { teams: state.scoreboard?.teams ?? [] } : g.data;
    out.push({ id, template: g.template, data });
  }
  if (which === 'live' && state.emergency) out.push({ id: 'emergency', template: 'emergency', data: { logo: state.emergencyLogo } });
  return out;
}

// Deja en `container` exactamente los gráficos del estado `which` ('preview' | 'live').
// No recrea elementos que no cambiaron (así no se reinician sus animaciones).
export function syncGraphics(container, state, which) {
  const list = wanted(state, which);
  const keys = new Map(list.map((g) => [g.id, JSON.stringify([g.template, g.data])]));
  for (const child of [...container.children]) {
    if (keys.get(child.dataset.gcId) !== child.dataset.key) child.remove();
  }
  const present = new Set([...container.children].map((c) => c.dataset.gcId));
  for (const g of list) {
    if (present.has(g.id)) continue;
    const node = renderGraphic(g.template, g.data);
    node.dataset.gcId = g.id;
    node.dataset.key = keys.get(g.id);
    node.classList.add('in');
    container.append(node);
  }
  const em = [...container.children].find((c) => c.dataset.gcId === 'emergency');
  if (em && container.lastElementChild !== em) container.append(em);
}

// Escala los gráficos (diseñados a 1920x1080) al ancho real del contenedor.
export function applyScale(container) {
  const s = container.clientWidth / 1920;
  for (const child of container.children) child.style.transform = `scale(${s})`;
}
