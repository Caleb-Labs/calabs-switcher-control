import { connect } from '/shared/client.js';
import { createSourceElement } from '/shared/sources.js';
import { keyToAction } from './keymap.js';
import { assignAreas } from './layout.js';
import { syncGraphics, applyScale } from '/graphics/layer.js';

const mv = document.getElementById('mv');
const tiles = new Map();
let sources = null;
let lastState = null;
let teams = [];
let preGfx = null, pgmGfx = null;

const conn = connect((state) => { lastState = state; render(); }, {
  onStatus: (on) => document.getElementById('conn').classList.toggle('on', on),
});
const send = (action) => conn.send(action);

document.getElementById('btn-cut').onclick = () => send({ type: 'TAKE', mode: 'cut' });
document.getElementById('btn-fade').onclick = () => send({ type: 'TAKE', mode: 'fade' });
document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea, select')) return;
  const action = keyToAction(e.key);
  if (action) { e.preventDefault(); send(action); }
});

function gridTemplate(ids) {
  const top = `"${Array(9).fill('pre').join(' ')} ${Array(9).fill('pgm').join(' ')}"`;
  const bottom = `"${ids.map((id) => `s-${id} s-${id}`).join(' ')}"`;
  return `${top} ${bottom}`;
}

function build(state) {
  mv.style.gridTemplateAreas = gridTemplate(state.sources.map((s) => s.id));
  const slot = (area, text) => {
    const d = document.createElement('div');
    d.className = 'slot'; d.style.gridArea = area; d.textContent = text; mv.append(d);
  };
  slot('pre', 'PREVIEW'); slot('pgm', 'PROGRAM');
  const cell = (area) => {
    const c = document.createElement('div'); c.className = 'gfx-cell'; c.style.gridArea = area;
    const g = document.createElement('div'); g.className = 'gfx'; c.append(g); mv.append(c);
    new ResizeObserver(() => applyScale(g)).observe(g);
    return g;
  };
  preGfx = cell('pre'); pgmGfx = cell('pgm');
  for (const s of state.sources) slot(`s-${s.id}`, s.label);
  for (const s of state.sources) {
    const meta = sources.find((x) => x.id === s.id) ?? s;
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.append(createSourceElement(meta, { url: meta.url }));
    const label = document.createElement('span'); label.className = 'label'; label.textContent = s.label;
    const hit = document.createElement('div'); hit.className = 'hit';
    hit.onclick = () => send({ type: 'SET_PREVIEW', id: s.id });
    tile.append(label, hit);
    mv.append(tile); tiles.set(s.id, tile);
  }
}

function render() {
  if (!sources || !lastState) return;
  if (!tiles.size) build(lastState);
  const areas = assignAreas(lastState);
  for (const s of lastState.sources) {
    const t = tiles.get(s.id);
    t.style.gridArea = areas[s.id];
    t.classList.toggle('pgm', areas[s.id] === 'pgm');
    t.classList.toggle('pre', areas[s.id] === 'pre');
    t.classList.toggle('nosignal', s.status === 'nosignal');
  }
  syncGraphics(preGfx, lastState, 'preview'); applyScale(preGfx);
  syncGraphics(pgmGfx, lastState, 'live'); applyScale(pgmGfx);
  document.getElementById('btn-emergency').classList.toggle('on', lastState.emergency);
}

// --- Panel de GC
const teamSel = document.getElementById('gc-team');
const playerSel = document.getElementById('gc-player');
function fillPlayers() {
  const t = teams[teamSel.selectedIndex];
  playerSel.replaceChildren(...(t?.players ?? []).map((p) => new Option(p, p)));
}
teamSel.onchange = fillPlayers;
fetch('/api/teams').then((r) => r.json()).then((list) => {
  teams = list;
  teamSel.replaceChildren(...list.map((t) => new Option(t.name, t.id)));
  fillPlayers();
});
document.querySelectorAll('[data-gc]').forEach((b) => {
  b.onclick = () => {
    const gcId = b.dataset.gc;
    if (b.dataset.act === 'arm') {
      if (gcId === 'name') {
        const t = teams[teamSel.selectedIndex];
        if (!t) return;
        send({ type: 'GC_ARM', gcId, template: 'gc-name', data: { team: t.name, player: playerSel.value, logo: t.logo } });
      } else send({ type: 'GC_ARM', gcId, template: 'scoreboard', data: {} });
    } else send({ type: b.dataset.act === 'live' ? 'GC_LIVE' : 'GC_OFF', gcId });
  };
});
document.getElementById('btn-emergency').onclick = () => send({ type: 'EMERGENCY', on: !lastState?.emergency });

fetch('/api/sources').then((r) => r.json()).then((list) => { sources = list; render(); });
