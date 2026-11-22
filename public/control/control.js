import { connect } from '/shared/client.js';
import { createSourceElement } from '/shared/sources.js';
import { keyToAction } from './keymap.js';
import { assignAreas } from './layout.js';

const mv = document.getElementById('mv');
const tiles = new Map();
let sources = null;
let lastState = null;

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
}

fetch('/api/sources').then((r) => r.json()).then((list) => { sources = list; render(); });
