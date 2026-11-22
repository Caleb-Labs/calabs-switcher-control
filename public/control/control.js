import { connect } from '/shared/client.js';
import { createSourceElement, applyVolumes } from '/shared/sources.js';
import { keyToAction, shouldHandleKey } from './keymap.js';
import { assignAreas, gridTemplate, clampSizes, bigColsFor, badgeText } from './layout.js';
import { renderSplitView } from './splitview.js';
import { initSplitPanel } from './splitpanel.js';
import { uploadFile } from './upload.js';
import { initMixer } from './mixer.js';
import { initGcMove } from './gcmove.js';
import { initConnPanel } from './connpanel.js';
import { syncGraphics, applyScale } from '/graphics/layer.js';
import { statusFromMessage } from '/shared/signal.js';
import { syncVtr } from '/shared/vtr.js';

const mv = document.getElementById('mv');
const tiles = new Map();
let sources = null;
let lastState = null;
let teams = [];
let preGfx = null, pgmGfx = null, preSlot = null, preBadge = null, preNote = null;
let seenSeq = null;
let lastConnRev = null;
let builtKey = null;
const slotEls = new Map();
const activeSrc = (st) => st.sources.filter((x) => x.active);

const conn = connect((state) => { lastState = state; render(); }, {
  onStatus: (on) => document.getElementById('conn').classList.toggle('on', on),
});
const send = (action) => conn.send(action);

const fadeInput = document.getElementById('fade-ms');
let fadeSent = 0;
fadeInput.oninput = () => { const now = Date.now(); if (now - fadeSent > 60) { fadeSent = now; send({ type: 'FADE_TIME', ms: Number(fadeInput.value) }); } };
fadeInput.onchange = () => { send({ type: 'FADE_TIME', ms: Number(fadeInput.value) }); fadeInput.blur(); };
document.getElementById('btn-cut').onclick = () => send({ type: 'TAKE', mode: 'cut' });
document.getElementById('btn-fade').onclick = () => send({ type: 'TAKE', mode: 'fade' });
document.addEventListener('keydown', (e) => {
  if (!shouldHandleKey(e)) return;
  const action = keyToAction(e.key);
  if (action) { e.preventDefault(); send(action); }
});

// --- Tamaño de las ventanas grandes: proporción del ancho de la ventana (se recuerda en este navegador)
let sizes = clampSizes(null);
try { sizes = clampSizes(JSON.parse(localStorage.getItem('multicam.sizes'))); } catch { /* sin almacenamiento: valores por defecto */ }
const bigInput = document.getElementById('sz-big');
function applySizes() {
  if (lastState) {
    const ids = activeSrc(lastState).map((s) => s.id);
    mv.style.setProperty('--cols', ids.length * 2);
    mv.style.gridTemplateAreas = gridTemplate(ids, bigColsFor(sizes.bigShare, ids.length));
  }
  bigInput.value = sizes.bigShare;
  if (preGfx) { applyScale(preGfx); applyScale(pgmGfx); }
}
bigInput.oninput = () => {
  sizes = clampSizes({ bigShare: bigInput.value });
  try { localStorage.setItem('multicam.sizes', JSON.stringify(sizes)); } catch { /* sin almacenamiento */ }
  applySizes();
};
bigInput.onchange = () => bigInput.blur(); // si no, el slider se queda con el foco y las teclas 1-9/Enter dejan de funcionar
document.getElementById('sz-reset').onclick = () => { sizes = clampSizes(null); try { localStorage.removeItem('multicam.sizes'); } catch { /* nada */ } applySizes(); };
window.addEventListener('resize', () => { if (preGfx) { applyScale(preGfx); applyScale(pgmGfx); } });

const splitPanel = initSplitPanel({ send });
const mixer = initMixer({ send });
const gcMove = initGcMove({ send });
const connPanel = initConnPanel({ send });

function build(state) {
  applySizes();
  const slot = (area, text) => {
    const d = document.createElement('div');
    d.className = 'slot'; d.style.gridArea = area; d.textContent = text; mv.append(d);
    return d;
  };
  preSlot = slot('pre', '');
  preBadge = document.createElement('span'); preBadge.className = 'badge'; preBadge.hidden = true;
  preNote = document.createElement('span'); preNote.className = 'note';
  preSlot.append(preBadge, preNote);
  slot('pgm', 'PROGRAM');
  const cell = (area) => {
    const c = document.createElement('div'); c.className = 'gfx-cell'; c.style.gridArea = area;
    const g = document.createElement('div'); g.className = 'gfx'; c.append(g); mv.append(c);
    new ResizeObserver(() => applyScale(g)).observe(c);
    return g;
  };
  preGfx = cell('pre'); pgmGfx = cell('pgm');
  for (const s of activeSrc(state)) slotEls.set(s.id, slot(`s-${s.id}`, s.label));
  for (const s of activeSrc(state)) {
    const meta = sources.find((x) => x.id === s.id) ?? s;
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.append(createSourceElement(meta, { url: meta.url }));
    const label = document.createElement('span'); label.className = 'label'; label.textContent = s.label;
    if (s.kind === 'vdo' || s.kind === 'twitch') {
      label.title = 'Doble clic para ponerle tu propio nombre';
      label.onclick = (e) => { e.stopPropagation(); send({ type: 'SET_PREVIEW', id: s.id }); };
      label.ondblclick = (e) => {
        e.stopPropagation();
        const cur = lastState.sources.find((x) => x.id === s.id)?.label ?? s.label;
        const name = window.prompt('Nombre de esta cámara (vacío = nombre por defecto):', cur);
        if (name !== null) send({ type: 'CAM_NAME', id: s.id, name });
      };
    }
    const badge = document.createElement('span'); badge.className = 'badge';
    const hit = document.createElement('div'); hit.className = 'hit';
    hit.onclick = () => send({ type: 'SET_PREVIEW', id: s.id });
    const sig = document.createElement('button');
    sig.className = 'sig'; sig.textContent = '⚠'; sig.title = 'Marcar sin señal / con señal';
    sig.onclick = (e) => {
      e.stopPropagation();
      const cur = lastState.sources.find((x) => x.id === s.id)?.status;
      send({ type: 'SOURCE_STATUS', id: s.id, status: cur === 'nosignal' ? 'live' : 'nosignal' });
    };
    const aud = document.createElement('button');
    aud.className = 'aud'; aud.textContent = '🔊'; aud.title = 'Encender / apagar el audio de esta cámara';
    aud.onclick = (e) => {
      e.stopPropagation();
      const on = lastState.mix[s.id]?.on;
      const master = lastState.audioMaster === s.id;
      if (on || master) { if (master) send({ type: 'SET_AUDIO_MASTER', id: null }); if (on) send({ type: 'MIX_TOGGLE', id: s.id }); }
      else send({ type: 'MIX_TOGGLE', id: s.id });
    };
    const isCam = s.kind === 'vdo' || s.kind === 'twitch';
    if (isCam) {
      tile.classList.add('cam');
      const vol = document.createElement('input');
      vol.type = 'range'; vol.min = 0; vol.max = 100; vol.step = 1; vol.className = 'tvol'; vol.title = 'Volumen de esta cámara';
      let t = 0;
      vol.oninput = () => { const now = Date.now(); if (now - t > 60) { t = now; send({ type: 'MIX_LEVEL', id: s.id, level: Number(vol.value) / 100 }); } };
      vol.onchange = () => { send({ type: 'MIX_LEVEL', id: s.id, level: Number(vol.value) / 100 }); vol.blur(); };
      vol.onpointerdown = (e) => e.stopPropagation();
      tile.append(aud, sig, vol);
    }
    tile.append(label, badge, hit);
    mv.append(tile); tiles.set(s.id, tile);
  }
}

// Ventana Preview cuando la misma fuente está también en Program: una cámara solo tiene un iframe, así que se abre un segundo
// (solo mientras coincidan; es una conexión extra a ese jugador, sin audio) para poder ver el Preview igualmente.
let mirror = null;
let mirrorId = null;
function syncMirror() {
  const same = lastState.preview === lastState.program;
  if (!same) { mirror?.remove(); mirror = null; mirrorId = null; return; }
  const id = lastState.preview;
  if (mirrorId !== id) {
    mirror?.remove();
    const meta = sources.find((x) => x.id === id) ?? { id, kind: 'vdo' };
    const label = lastState.sources.find((x) => x.id === id)?.label ?? id;
    mirror = document.createElement('div');
    mirror.className = 'tile pre mirror';
    mirror.style.gridArea = 'pre';
    const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = badgeText('pre', label);
    mirror.append(createSourceElement(meta, { url: meta.url }), badge);
    mv.append(mirror);
    mirrorId = id;
  }
  const split = mirror.querySelector('.split-view'); if (split) renderSplitView(split, lastState);
  const v = mirror.querySelector('video'); if (v) { syncVtr(v, lastState.vtr); v.muted = true; }
  applyVolumes(mirror, () => 0);
}

const muteAll = () => { for (const t of tiles.values()) applyVolumes(t, () => 0); if (mirror) applyVolumes(mirror, () => 0); };
mv.addEventListener('load', muteAll, true); // iframes recién cargados

function render() {
  if (!sources || !lastState) return;
  const key = activeSrc(lastState).map((x) => x.id).join();
  if (key !== builtKey) { // cambió qué cámaras se ven: se reconstruye la grilla
    mv.replaceChildren(); tiles.clear(); slotEls.clear(); mirror = null; mirrorId = null;
    build(lastState);
    builtKey = key;
  }
  const areas = assignAreas(lastState);
  for (const s of activeSrc(lastState)) {
    const t = tiles.get(s.id);
    t.style.gridArea = areas[s.id];
    t.querySelector('.label').textContent = s.label;
    if (slotEls.has(s.id)) slotEls.get(s.id).textContent = s.label;
    t.classList.toggle('pgm', areas[s.id] === 'pgm');
    t.classList.toggle('pre', areas[s.id] === 'pre');
    t.classList.toggle('nosignal', s.status === 'nosignal');
    t.querySelector('.badge').textContent = badgeText(areas[s.id], s.label);
  }
  const progLabel = lastState.sources.find((x) => x.id === lastState.program)?.label;
  const same = lastState.preview === lastState.program;
  preBadge.hidden = true;
  preNote.textContent = 'PREVIEW';
  const splitEl = tiles.get('split')?.querySelector('.split-view');
  if (splitEl) renderSplitView(splitEl, lastState);
  splitPanel.render(lastState);
  mixer.render(lastState);
  connPanel.render(lastState);
  if (lastConnRev !== null && lastState.connRev !== lastConnRev) reloadSources(); // cambió una sala/contraseña/calidad: se reconectan las cámaras
  lastConnRev = lastState.connRev;
  gcMove.render(lastState);
  syncGraphics(preGfx, lastState, 'preview'); applyScale(preGfx);
  syncGraphics(pgmGfx, lastState, 'live'); applyScale(pgmGfx);
  document.getElementById('btn-emergency').classList.toggle('on', lastState.emergency);
  for (const s of lastState.sources) {
    const t = tiles.get(s.id);
    if (!t) continue;
    const m = lastState.mix[s.id];
    t.classList.toggle('master', lastState.audioMaster === s.id || !!m?.on);
    t.classList.toggle('sel', lastState.mixSel === s.id);
    const vol = t.querySelector('.tvol');
    if (vol && document.activeElement !== vol) vol.value = Math.round((m?.level ?? 1) * 100);
  }
  syncMirror();
  const fade = document.getElementById('fade-ms');
  if (document.activeElement !== fade) fade.value = lastState.fadeMs;
  document.getElementById('fade-val').textContent = `${(lastState.fadeMs / 1000).toFixed(1)} s`;
  const lt = lastState.lastTake;
  if (lt && lt.seq !== seenSeq) {
    if (seenSeq !== null && lt.mode === 'fade') tiles.get(lt.to)?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: lt.ms || 500, easing: 'linear' }); // se ve el fade también en el panel
    seenSeq = lt.seq;
  } else if (!lt && seenSeq === null) seenSeq = 0;
  syncVtrPanel();
  syncEmergencyPanel();
  syncCamSettings();
  muteAll(); // el audio sale solo por /program (OBS); aquí todo en silencio
  const pct = (c) => (c.muted ? 'mute' : `${Math.round(c.level * 100)}%`);
  document.getElementById('vol').textContent = `🔊 cámara ${pct(lastState.audio.cam)} · VTR ${pct(lastState.audio.vtr)}`;
  const warn = document.getElementById('warn');
  warn.hidden = !lastState.scoreboard.stale;
  warn.textContent = 'marcador sin actualizar';
}

// --- Panel de GC: el texto es libre; elegir equipo/jugador solo rellena los campos
const teamSel = document.getElementById('gc-team');
const titleIn = document.getElementById('gc-title');
const subIn = document.getElementById('gc-sub');
function fillText() { titleIn.value = teams[teamSel.selectedIndex]?.name ?? ''; } // solo rellena el título; el subtítulo es libre
teamSel.onchange = () => { fillText(); teamSel.blur(); };
fetch('/api/teams').then((r) => r.json()).then((list) => {
  teams = list;
  teamSel.replaceChildren(...list.map((t) => new Option(t.name, t.id)));
  fillText();
});
document.querySelectorAll('[data-gc]').forEach((b) => {
  b.onclick = () => {
    const gcId = b.dataset.gc;
    if (b.dataset.act === 'arm') {
      if (gcId === 'name') {
        const t = teams[teamSel.selectedIndex];
        send({ type: 'GC_ARM', gcId, template: 'gc-name', data: { team: titleIn.value, player: subIn.value, logo: t && titleIn.value === t.name ? t.logo : null } });
      } else send({ type: 'GC_ARM', gcId, template: 'scoreboard', data: {} });
    } else send({ type: b.dataset.act === 'live' ? 'GC_LIVE' : 'GC_OFF', gcId });
  };
});
document.getElementById('btn-emergency').onclick = () => send({ type: 'EMERGENCY', on: !lastState?.emergency });

const loadSources = () => fetch('/api/sources?for=control').then((r) => r.json()).then((list) => { sources = list; });
loadSources().then(() => render());
function reloadSources() { loadSources().then(() => { builtKey = null; render(); }); }

// Detección automática (mejor esfuerzo) por los eventos del iframe de VDO.Ninja.
window.addEventListener('message', (e) => {
  if (!sources || !lastState) return;
  const r = statusFromMessage(e, sources);
  if (r && lastState.sources.find((x) => x.id === r.id)?.status !== r.status) send({ type: 'SOURCE_STATUS', ...r });
});

// --- Panel del VTR
const vtrSel = document.getElementById('vtr-files');
const label = (f) => (f === '@tabla' ? 'Tabla de posiciones' : f);
function syncVtrPanel() {
  const { files, current } = lastState.vtr;
  const key = JSON.stringify(files);
  if (vtrSel.dataset.key !== key) {
    vtrSel.dataset.key = key;
    vtrSel.replaceChildren(...files.map((f) => new Option(label(f), f)));
  }
  vtrSel.value = current ?? '';
  document.getElementById('vtr-empty').hidden = files.some((f) => f !== '@tabla');
  const v = tiles.get('vtr')?.querySelector('video');
  if (v) { syncVtr(v, lastState.vtr); v.muted = true; v.onended = () => send({ type: 'VTR_PAUSE' }); }
}
vtrSel.onchange = () => send({ type: 'VTR_SELECT', file: vtrSel.value });
document.getElementById('vtr-play').onclick = () => send({ type: 'VTR_PLAY' });
document.getElementById('vtr-pause').onclick = () => send({ type: 'VTR_PAUSE' });
document.getElementById('vtr-next').onclick = () => send({ type: 'VTR_NEXT' });

// Subir archivos al VTR
const uploadInput = document.getElementById('vtr-upload');
uploadInput.onchange = async () => {
  const status = document.getElementById('vtr-upload-status');
  const files = [...uploadInput.files];
  uploadInput.value = '';
  let ok = 0;
  for (const f of files) {
    status.textContent = `Subiendo ${f.name}…`;
    try { await uploadFile(f); ok++; } catch (e) { alert(`No se pudo subir ${f.name}: ${e.message}`); }
  }
  status.textContent = ok ? `${ok} archivo(s) subido(s)` : '';
  setTimeout(() => { status.textContent = ''; }, 4000);
};

// --- Archivo de la emergencia (foto o video)
const emSel = document.getElementById('em-file');
emSel.onchange = () => { send({ type: 'EMERGENCY_FILE', file: emSel.value || null }); emSel.blur(); };
document.getElementById('em-upload').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { send({ type: 'EMERGENCY_FILE', file: await uploadFile(f) }); } catch (err) { alert(`No se pudo subir: ${err.message}`); }
};
function syncEmergencyPanel() {
  const media = lastState.vtr.files.filter((f) => f !== '@tabla');
  const key = JSON.stringify(media);
  if (emSel.dataset.key !== key) { emSel.dataset.key = key; emSel.replaceChildren(new Option('(logo / texto)', ''), ...media.map((f) => new Option(f, f))); }
  emSel.value = lastState.emergencyFile ?? '';
}

// --- Cuántas cámaras se ven (equipos) y cámara aérea
const camCountSel = document.getElementById('cam-count');
const aerialChk = document.getElementById('aerial-on');
camCountSel.onchange = () => { send({ type: 'SET_CAM_COUNT', n: Number(camCountSel.value) }); camCountSel.blur(); };
aerialChk.onchange = () => { send({ type: 'SET_AERIAL', on: aerialChk.checked }); aerialChk.blur(); };
function syncCamSettings() {
  const teamsN = lastState.srcBase.filter((b) => !b.aerial).length;
  if (camCountSel.options.length !== teamsN) camCountSel.replaceChildren(...Array.from({ length: teamsN }, (_, i) => new Option(String(i + 1), String(i + 1))));
  camCountSel.value = String(lastState.camCount);
  const hasAerial = lastState.srcBase.some((b) => b.aerial);
  aerialChk.parentElement.hidden = !hasAerial;
  aerialChk.checked = lastState.aerialOn;
}
