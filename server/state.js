// Estado puro del switcher. Sin efectos: reduce(state, action) devuelve un estado nuevo.

// ---------- Pantalla dividida ----------
// Rectángulos en fracciones del lienzo 1920x1080 (w y h iguales = recuadro 16:9).
const LAYOUTS = {
  1: [[0.2, 0.2, 0.6, 0.6]],
  2: [[0.01, 0.26, 0.48, 0.48], [0.51, 0.26, 0.48, 0.48]],
  3: [[0.08, 0.05, 0.4, 0.4], [0.52, 0.05, 0.4, 0.4], [0.3, 0.52, 0.4, 0.4]],
  4: [[0.08, 0.05, 0.4, 0.4], [0.52, 0.05, 0.4, 0.4], [0.08, 0.52, 0.4, 0.4], [0.52, 0.52, 0.4, 0.4]],
  5: [[0.03, 0.08, 0.3, 0.3], [0.35, 0.08, 0.3, 0.3], [0.67, 0.08, 0.3, 0.3], [0.19, 0.5, 0.3, 0.3], [0.51, 0.5, 0.3, 0.3]],
  6: [[0.03, 0.08, 0.3, 0.3], [0.35, 0.08, 0.3, 0.3], [0.67, 0.08, 0.3, 0.3], [0.03, 0.5, 0.3, 0.3], [0.35, 0.5, 0.3, 0.3], [0.67, 0.5, 0.3, 0.3]],
  7: [[0.03, 0.12, 0.22, 0.22], [0.27, 0.12, 0.22, 0.22], [0.51, 0.12, 0.22, 0.22], [0.75, 0.12, 0.22, 0.22], [0.15, 0.46, 0.22, 0.22], [0.39, 0.46, 0.22, 0.22], [0.63, 0.46, 0.22, 0.22]],
  8: [[0.03, 0.12, 0.22, 0.22], [0.27, 0.12, 0.22, 0.22], [0.51, 0.12, 0.22, 0.22], [0.75, 0.12, 0.22, 0.22], [0.03, 0.46, 0.22, 0.22], [0.27, 0.46, 0.22, 0.22], [0.51, 0.46, 0.22, 0.22], [0.75, 0.46, 0.22, 0.22]],
  9: [[0.06, 0.04, 0.28, 0.28], [0.36, 0.04, 0.28, 0.28], [0.66, 0.04, 0.28, 0.28], [0.06, 0.36, 0.28, 0.28], [0.36, 0.36, 0.28, 0.28], [0.66, 0.36, 0.28, 0.28], [0.06, 0.68, 0.28, 0.28], [0.36, 0.68, 0.28, 0.28], [0.66, 0.68, 0.28, 0.28]],
};
const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const BG_FILE = (n) => new RegExp(`^split-${n}\\.(png|jpe?g|svg|mp4|webm|mov)$`, 'i');
const MAX_FIGHTS = 50;
const isPlainObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

export function defaultSlots(count, cams) {
  if (!LAYOUTS[count]) throw new Error(`cantidad inválida: ${count}`);
  return LAYOUTS[count].map(([x, y, w, h], i) => ({ cam: cams[i % cams.length], x, y, w, h }));
}

function clampRect({ x, y, w, h }) {
  if (![x, y, w, h].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const cw = Math.min(1, Math.max(0.05, w));
  const ch = Math.min(1, Math.max(0.05, h));
  return { x: Math.min(1 - cw, Math.max(0, x)), y: Math.min(1 - ch, Math.max(0, y)), w: cw, h: ch };
}

function cleanSlots(raw, count, camIds) {
  const defaults = defaultSlots(count, camIds);
  if (!Array.isArray(raw) || raw.length !== count) return defaults;
  return raw.map((s, i) => {
    const rect = isPlainObj(s) ? clampRect(s) : null;
    return { cam: isPlainObj(s) && camIds.includes(s.cam) ? s.cam : defaults[i].cam, ...(rect ?? { x: defaults[i].x, y: defaults[i].y, w: defaults[i].w, h: defaults[i].h }) };
  });
}

const cleanGcPos = (p) => (isNum(p?.x) && isNum(p?.y) ? { x: clampPos(p.x), y: clampPos(p.y) } : null);
const DEFAULT_OFF = { x: 0.03, y: 0.78 }; // dónde nace el GC dentro de su recuadro (fracciones del recuadro)
const str = (v) => (typeof v === 'string' ? v.slice(0, 60) : '');
const clampPos = (v) => Math.min(0.95, Math.max(0, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const cleanTexts = (raw, n) => Array.from({ length: n }, (_, i) => ({ title: str(raw?.[i]?.title), subtitle: str(raw?.[i]?.subtitle) }));
const cleanOffs = (raw, n) => Array.from({ length: n }, (_, i) => (isNum(raw?.[i]?.x) && isNum(raw?.[i]?.y) ? { x: clampPos(raw[i].x), y: clampPos(raw[i].y) } : { ...DEFAULT_OFF }));

// Repara/valida lo que se leyó del archivo guardado (puede venir corrupto).
export function normalizeSplit(raw, camIds) {
  const r = isPlainObj(raw) ? raw : {};
  const layouts = {};
  for (const n of COUNTS) layouts[n] = cleanSlots(isPlainObj(r.layouts) ? r.layouts[n] : null, n, camIds);
  const bgs = {};
  if (isPlainObj(r.bgs)) for (const n of COUNTS) if (typeof r.bgs[n] === 'string' && r.bgs[n]) bgs[n] = r.bgs[n];
  const texts = {};
  const gcOffs = {};
  for (const n of COUNTS) {
    texts[n] = cleanTexts(isPlainObj(r.texts) ? r.texts[n] : null, n);
    gcOffs[n] = cleanOffs(isPlainObj(r.gcOffs) ? r.gcOffs[n] : null, n);
  }
  const fights = [];
  if (Array.isArray(r.fights)) {
    for (const f of r.fights) {
      if (!isPlainObj(f) || typeof f.id !== 'string' || !f.id || typeof f.name !== 'string' || !COUNTS.includes(f.count)) continue;
      fights.push({ id: f.id, name: f.name, count: f.count, slots: cleanSlots(f.slots, f.count, camIds), texts: cleanTexts(f.texts, f.count), offs: cleanOffs(f.offs, f.count) });
      if (fights.length >= MAX_FIGHTS) break;
    }
  }
  return { count: COUNTS.includes(r.count) ? r.count : 2, layouts, bgs, texts, gcOffs, fights };
}

const slug = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pelea';
const camIdsOf = (state) => state.sources.filter((x) => x.kind !== 'vtr' && x.kind !== 'split').map((x) => x.id);
const clone = (x) => JSON.parse(JSON.stringify(x));
const teamOf = (sources, id) => sources.find((x) => x.id === id)?.team ?? '';

// Textos iniciales de los GC de la dividida: el nombre del equipo de la cámara de cada recuadro.
function withTeamTexts(split, sources) {
  const texts = {};
  for (const n of COUNTS) {
    texts[n] = split.texts[n].map((t, i) => (t.title || t.subtitle ? t : { ...t, title: teamOf(sources, split.layouts[n][i].cam) }));
  }
  return { ...split, texts };
}

// Si el texto del recuadro era el automático (nombre del equipo de la cámara anterior, o vacío), sigue a la cámara nueva; uno escrito a mano se respeta.
function retext(sources, texts, i, oldCam, newCam) {
  const t = texts[i];
  if (t.subtitle || (t.title !== '' && t.title !== teamOf(sources, oldCam))) return texts;
  return texts.map((x, k) => (k === i ? { ...x, title: teamOf(sources, newCam) } : x));
}
const withSlots = (state, fn) => {
  const n = state.split.count;
  const slots = fn(state.split.layouts[n]);
  return slots ? { ...state, split: { ...state.split, layouts: { ...state.split.layouts, [n]: slots } } } : state;
};

// Lo que se guarda en disco (data/split.json) para sobrevivir a reinicios.
export const persistable = (state) => ({ split: state.split, gcPos: state.gcPos, emergencyFile: state.emergencyFile });

export function createState(config) {
  const saved = config.saved ?? { split: config.splitSaved, gcPos: config.gcPosSaved }; // compatibilidad con el formato anterior
  const sources = config.teams.map((t, i) => ({
    id: `cam${i + 1}`,
    label: `Cámara ${i + 1}`,
    team: t.name, // el nombre del equipo se usa en los GC
    kind: t.source?.kind ?? 'vdo',
    status: 'live',
    players: t.players,
    logo: t.logo ?? null,
  }));
  if (config.aerial) {
    sources.push({ id: `cam${sources.length + 1}`, label: `Cámara ${sources.length + 1}`, kind: config.aerial.source.kind, status: 'live', players: undefined, logo: null });
  }
  const camIds = sources.map((x) => x.id);
  sources.push({ id: 'vtr', label: 'VTR', kind: 'vtr', status: 'live' });
  sources.push({ id: 'split', label: 'Pantalla dividida', kind: 'split', status: 'live' });
  return {
    sources,
    split: withTeamTexts(normalizeSplit(saved.split, camIds), sources),
    emergencyFile: typeof saved.emergencyFile === 'string' ? saved.emergencyFile : null,
    splitGc: 'off',
    fadeMs: 500,
    mixSel: camIds[0],
    toneSeq: 0,
    gcPos: { name: cleanGcPos(saved.gcPos?.name), score: cleanGcPos(saved.gcPos?.score) },
    mix: Object.fromEntries(camIds.map((id) => [id, { level: 1, on: false }])),
    program: 'cam1',
    preview: 'cam2',
    lastTake: null,
    audioMaster: null,
    gc: {},
    emergency: false,
    emergencyLogo: config.emergencyLogo ?? null,
    vtrDefault: config.vtrDefault ?? null,
    audio: { cam: { level: 1, muted: false }, vtr: { level: 1, muted: false } },
    gcPlayer: 0,
    vtr: { files: [], current: null, playing: false },
    scoreboard: { teams: [], updatedAt: null, stale: false },
  };
}

const GC_TEMPLATES = new Set(['gc-name', 'scoreboard', 'standings']);
const isPlainObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const hasSource = (s, id) => s.sources.some((x) => x.id === id);

export function reduce(state, action) {
  switch (action?.type) {
    case 'SET_PREVIEW':
      return hasSource(state, action.id) ? { ...state, preview: action.id } : state;

    case 'TAKE': {
      if (state.preview === state.program) return state;
      const mode = action.mode === 'fade' ? 'fade' : 'cut';
      return {
        ...state,
        program: state.preview,
        preview: state.program,
        lastTake: { mode, from: state.program, to: state.preview, seq: (state.lastTake?.seq ?? 0) + 1, ms: mode === 'fade' ? state.fadeMs : 0 },
      };
    }

    case 'SET_AUDIO_MASTER':
      if (action.id === null) return { ...state, audioMaster: null };
      return hasSource(state, action.id) && action.id !== 'vtr' && action.id !== 'split' ? { ...state, audioMaster: action.id } : state;

    case 'SOURCE_STATUS':
      if (!hasSource(state, action.id) || !['live', 'nosignal'].includes(action.status)) return state;
      return {
        ...state,
        sources: state.sources.map((x) => (x.id === action.id ? { ...x, status: action.status } : x)),
      };

    case 'GC_ARM':
      if (typeof action.gcId !== 'string' || !action.gcId || action.gcId in Object.prototype || !GC_TEMPLATES.has(action.template)) return state;
      return { ...state, gc: { ...state.gc, [action.gcId]: { template: action.template, data: isPlainObject(action.data) ? action.data : {}, state: 'preview' } } };
    case 'GC_LIVE':
    case 'GC_OFF': {
      if (!Object.hasOwn(state.gc, action.gcId)) return state;
      const g = state.gc[action.gcId];
      return { ...state, gc: { ...state.gc, [action.gcId]: { ...g, state: action.type === 'GC_LIVE' ? 'live' : 'off' } } };
    }

    case 'EMERGENCY':
      return { ...state, emergency: !!action.on };
    case 'EMERGENCY_FILE':
      if (action.file === null) return { ...state, emergencyFile: null };
      return typeof action.file === 'string' && action.file !== '@tabla' && state.vtr.files.includes(action.file) ? { ...state, emergencyFile: action.file } : state;

    case 'VTR_FILES': {
      const files = Array.isArray(action.files) ? action.files : [];
      const kept = files.includes(state.vtr.current);
      // Si no hay archivo elegido (o se borró), se muestra el de respaldo (vtrDefault) en vez de negro.
      const current = kept ? state.vtr.current : files.includes(state.vtrDefault) ? state.vtrDefault : null;
      const bgs = {};
      for (const n of COUNTS) {
        const cur = state.split.bgs[n];
        const found = cur && files.includes(cur) ? cur : files.find((f) => BG_FILE(n).test(f));
        if (found) bgs[n] = found;
      }
      return { ...state, emergencyFile: files.includes(state.emergencyFile) ? state.emergencyFile : null, vtr: { ...state.vtr, files, current, playing: kept ? state.vtr.playing : false }, split: { ...state.split, bgs } };
    }
    case 'VTR_SELECT':
      return state.vtr.files.includes(action.file) ? { ...state, vtr: { ...state.vtr, current: action.file } } : state;
    case 'VTR_PLAY':
      return state.vtr.current ? { ...state, vtr: { ...state.vtr, playing: true } } : state;
    case 'VTR_PAUSE':
      return { ...state, vtr: { ...state.vtr, playing: false } };
    case 'VTR_NEXT': {
      const { files, current } = state.vtr;
      if (!files.length) return state;
      const next = files[(files.indexOf(current) + 1) % files.length];
      return { ...state, vtr: { ...state.vtr, current: next } };
    }

    case 'VTR_PREV': {
      const { files, current } = state.vtr;
      if (!files.length) return state;
      const i = files.indexOf(current);
      return { ...state, vtr: { ...state.vtr, current: files[i < 0 ? files.length - 1 : (i - 1 + files.length) % files.length] } };
    }
    case 'VTR_TOGGLE':
      return state.vtr.current ? { ...state, vtr: { ...state.vtr, playing: !state.vtr.playing } } : state;

    case 'PREVIEW_STEP': {
      const ids = state.sources.map((x) => x.id);
      const dir = action.dir > 0 ? 1 : -1;
      let i = ids.indexOf(state.preview);
      for (let k = 0; k < ids.length; k++) {
        i = (i + dir + ids.length) % ids.length;
        if (ids[i] !== state.program) return { ...state, preview: ids[i] };
      }
      return state;
    }
    case 'AUDIO_MASTER_STEP': {
      const cams = camIdsOf(state);
      const dir = action.dir > 0 ? 1 : -1;
      const i = cams.indexOf(state.audioMaster);
      const next = i < 0 ? (dir > 0 ? 0 : cams.length - 1) : (i + dir + cams.length) % cams.length;
      return { ...state, audioMaster: cams[next] };
    }
    case 'ADJUST_VOLUME': {
      const t = action.target;
      if ((t !== 'cam' && t !== 'vtr') || !Number.isFinite(action.delta)) return state;
      const level = Math.min(1, Math.max(0, Math.round((state.audio[t].level + action.delta) * 100) / 100));
      return { ...state, audio: { ...state.audio, [t]: { ...state.audio[t], level } } };
    }
    case 'TOGGLE_MUTE': {
      const t = action.target;
      if (t !== 'cam' && t !== 'vtr') return state;
      return { ...state, audio: { ...state.audio, [t]: { ...state.audio[t], muted: !state.audio[t].muted } } };
    }
    case 'EMERGENCY_TOGGLE':
      return { ...state, emergency: !state.emergency };
    case 'GC_PLAYER_NEXT':
      return { ...state, gcPlayer: state.gcPlayer ? 0 : 1 };
    case 'GC_NAME_PREVIEW': {
      const src = state.sources.find((x) => x.id === state.preview);
      if (!src || src.kind === 'vtr' || !Array.isArray(src.players)) return state;
      const data = { team: src.team ?? src.label, player: src.players[state.gcPlayer] ?? src.players[0], logo: src.logo ?? null };
      return { ...state, gc: { ...state.gc, name: { template: 'gc-name', data, state: 'preview' } } };
    }

    case 'SCOREBOARD_UPDATE': {
      if (!Array.isArray(action.teams)) return state;
      const teams = action.teams;
      if (!state.scoreboard.stale && JSON.stringify(teams) === JSON.stringify(state.scoreboard.teams)) return state;
      return { ...state, scoreboard: { teams, updatedAt: Date.now(), stale: false } };
    }
    case 'SCOREBOARD_STALE':
      if (state.scoreboard.stale) return state;
      return { ...state, scoreboard: { ...state.scoreboard, stale: true } };

    case 'SPLIT_SET_COUNT':
      return COUNTS.includes(action.count) ? { ...state, split: { ...state.split, count: action.count } } : state;
    case 'SPLIT_SET_CAMS': { // elegir las cámaras con botones: la cantidad sale de cuántas se eligen, en orden de clic
      const cams = action.cams;
      const valid = camIdsOf(state);
      if (!Array.isArray(cams) || cams.length < 1 || cams.length > 9 || new Set(cams).size !== cams.length || !cams.every((c) => valid.includes(c))) return state;
      const n = cams.length;
      const old = state.split.layouts[n];
      const slots = old.map((s, i) => ({ ...s, cam: cams[i] }));
      let texts = state.split.texts[n];
      for (let i = 0; i < n; i++) texts = retext(state.sources, texts, i, old[i].cam, cams[i]);
      return { ...state, split: { ...state.split, count: n, layouts: { ...state.split.layouts, [n]: slots }, texts: { ...state.split.texts, [n]: texts } } };
    }
    case 'SPLIT_SET_TEXT': {
      const n = state.split.count;
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= n) return state;
      const texts = state.split.texts[n].map((t, i) => (i === action.index ? { title: str(action.title), subtitle: str(action.subtitle) } : t));
      return { ...state, split: { ...state.split, texts: { ...state.split.texts, [n]: texts } } };
    }
    case 'SPLIT_SET_GCPOS': {
      const n = state.split.count;
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= n || !isNum(action.x) || !isNum(action.y)) return state;
      const offs = state.split.gcOffs[n].map((o, i) => (i === action.index ? { x: clampPos(action.x), y: clampPos(action.y) } : o));
      return { ...state, split: { ...state.split, gcOffs: { ...state.split.gcOffs, [n]: offs } } };
    }
    case 'SPLIT_GC':
      return ['off', 'preview', 'live'].includes(action.to) ? { ...state, splitGc: action.to } : state;
    case 'GC_SET_POS':
      if (!Object.hasOwn(state.gcPos, action.gcId) || !isNum(action.x) || !isNum(action.y)) return state;
      return { ...state, gcPos: { ...state.gcPos, [action.gcId]: { x: clampPos(action.x), y: clampPos(action.y) } } };
    case 'GC_RESET_POS':
      return Object.hasOwn(state.gcPos, action.gcId) ? { ...state, gcPos: { ...state.gcPos, [action.gcId]: null } } : state;
    case 'FADE_TIME':
      return isNum(action.ms) ? { ...state, fadeMs: Math.min(5000, Math.max(100, Math.round(action.ms))) } : state;
    case 'FADE_STEP':
      return { ...state, fadeMs: Math.min(5000, Math.max(100, state.fadeMs + (action.dir > 0 ? 100 : -100))) };
    case 'MIX_SELECT': {
      const cams = camIdsOf(state);
      const i = cams.indexOf(state.mixSel);
      return { ...state, mixSel: cams[(i + (action.dir > 0 ? 1 : -1) + cams.length) % cams.length] };
    }
    case 'MIX_ADJUST': {
      if (!isNum(action.delta) || !Object.hasOwn(state.mix, state.mixSel)) return state;
      const m = state.mix[state.mixSel];
      return { ...state, mix: { ...state.mix, [state.mixSel]: { ...m, level: Math.min(1, Math.max(0, Math.round((m.level + action.delta) * 100) / 100)) } } };
    }
    case 'MIX_SEL_TOGGLE': {
      const id = state.mixSel;
      if (!Object.hasOwn(state.mix, id)) return state;
      const audible = state.audioMaster === id || state.mix[id].on;
      return { ...state, audioMaster: state.audioMaster === id ? null : state.audioMaster, mix: { ...state.mix, [id]: { ...state.mix[id], on: !audible } } };
    }
    case 'TEST_TONE':
      return { ...state, toneSeq: state.toneSeq + 1 };
    case 'MIX_TOGGLE':
      if (!Object.hasOwn(state.mix, action.id)) return state;
      return { ...state, mix: { ...state.mix, [action.id]: { ...state.mix[action.id], on: !state.mix[action.id].on } } };
    case 'MIX_LEVEL':
      if (!Object.hasOwn(state.mix, action.id) || !isNum(action.level)) return state;
      return { ...state, mix: { ...state.mix, [action.id]: { ...state.mix[action.id], level: Math.min(1, Math.max(0, Math.round(action.level * 100) / 100)) } } };
    case 'SET_VOLUME':
      if ((action.target !== 'cam' && action.target !== 'vtr') || !isNum(action.level)) return state;
      return { ...state, audio: { ...state.audio, [action.target]: { ...state.audio[action.target], level: Math.min(1, Math.max(0, Math.round(action.level * 100) / 100)) } } };
    case 'SPLIT_SET_CAM': {
      const n = state.split.count;
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= n || !camIdsOf(state).includes(action.cam)) return state;
      const oldCam = state.split.layouts[n][action.index].cam;
      const moved = withSlots(state, (slots) => slots.map((s, i) => (i === action.index ? { ...s, cam: action.cam } : s)));
      return { ...moved, split: { ...moved.split, texts: { ...moved.split.texts, [n]: retext(state.sources, state.split.texts[n], action.index, oldCam, action.cam) } } };
    }
    case 'SPLIT_SET_RECT': {
      const n = state.split.count;
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= n) return state;
      const rect = clampRect(action);
      if (!rect) return state;
      return withSlots(state, (slots) => slots.map((s, i) => (i === action.index ? { cam: s.cam, ...rect } : s)));
    }
    case 'SPLIT_RESET_LAYOUT': {
      const n = state.split.count;
      const moved = withSlots(state, (slots) => defaultSlots(n, camIdsOf(state)).map((d, i) => ({ ...d, cam: slots[i].cam })));
      return { ...moved, split: { ...moved.split, gcOffs: { ...moved.split.gcOffs, [n]: cleanOffs(null, n) } } }; // los GC de los recuadros también vuelven a su sitio
    }
    case 'SPLIT_SET_BG': {
      if (!COUNTS.includes(action.count)) return state;
      const bgs = { ...state.split.bgs };
      if (action.file === null) delete bgs[action.count];
      else if (typeof action.file === 'string' && state.vtr.files.includes(action.file)) bgs[action.count] = action.file;
      else return state;
      return { ...state, split: { ...state.split, bgs } };
    }
    case 'SPLIT_SAVE_FIGHT': {
      const name = typeof action.name === 'string' ? action.name.trim().slice(0, 40) : '';
      if (!name) return state;
      const n = state.split.count;
      const fight = { id: slug(name), name, count: n, slots: clone(state.split.layouts[n]), texts: clone(state.split.texts[n]), offs: clone(state.split.gcOffs[n]) };
      const exists = state.split.fights.some((f) => f.id === fight.id);
      if (!exists && state.split.fights.length >= MAX_FIGHTS) return state;
      const fights = exists ? state.split.fights.map((f) => (f.id === fight.id ? fight : f)) : [...state.split.fights, fight];
      return { ...state, split: { ...state.split, fights } };
    }
    case 'SPLIT_LOAD_FIGHT': {
      const f = state.split.fights.find((x) => x.id === action.id);
      if (!f) return state;
      return { ...state, split: { ...state.split, count: f.count, layouts: { ...state.split.layouts, [f.count]: clone(f.slots) }, texts: { ...state.split.texts, [f.count]: cleanTexts(f.texts, f.count) }, gcOffs: { ...state.split.gcOffs, [f.count]: cleanOffs(f.offs, f.count) } } };
    }
    case 'SPLIT_DELETE_FIGHT': {
      const fights = state.split.fights.filter((f) => f.id !== action.id);
      return fights.length === state.split.fights.length ? state : { ...state, split: { ...state.split, fights } };
    }

    default:
      return state;
  }
}
