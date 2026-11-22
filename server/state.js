// Estado puro del switcher. Sin efectos: reduce(state, action) devuelve un estado nuevo.

// ---------- Pantalla dividida ----------
// Rectángulos en fracciones del lienzo 1920x1080 (w y h iguales = recuadro 16:9).
const LAYOUTS = {
  2: [[0.01, 0.26, 0.48, 0.48], [0.51, 0.26, 0.48, 0.48]],
  3: [[0.08, 0.05, 0.4, 0.4], [0.52, 0.05, 0.4, 0.4], [0.3, 0.52, 0.4, 0.4]],
  4: [[0.08, 0.05, 0.4, 0.4], [0.52, 0.05, 0.4, 0.4], [0.08, 0.52, 0.4, 0.4], [0.52, 0.52, 0.4, 0.4]],
  5: [[0.03, 0.08, 0.3, 0.3], [0.35, 0.08, 0.3, 0.3], [0.67, 0.08, 0.3, 0.3], [0.19, 0.5, 0.3, 0.3], [0.51, 0.5, 0.3, 0.3]],
  6: [[0.03, 0.08, 0.3, 0.3], [0.35, 0.08, 0.3, 0.3], [0.67, 0.08, 0.3, 0.3], [0.03, 0.5, 0.3, 0.3], [0.35, 0.5, 0.3, 0.3], [0.67, 0.5, 0.3, 0.3]],
};
const COUNTS = [2, 3, 4, 5, 6];
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

// Repara/valida lo que se leyó del archivo guardado (puede venir corrupto).
export function normalizeSplit(raw, camIds) {
  const r = isPlainObj(raw) ? raw : {};
  const layouts = {};
  for (const n of COUNTS) layouts[n] = cleanSlots(isPlainObj(r.layouts) ? r.layouts[n] : null, n, camIds);
  const bgs = {};
  if (isPlainObj(r.bgs)) for (const n of COUNTS) if (typeof r.bgs[n] === 'string' && r.bgs[n]) bgs[n] = r.bgs[n];
  const fights = [];
  if (Array.isArray(r.fights)) {
    for (const f of r.fights) {
      if (!isPlainObj(f) || typeof f.id !== 'string' || !f.id || typeof f.name !== 'string' || !COUNTS.includes(f.count)) continue;
      fights.push({ id: f.id, name: f.name, count: f.count, slots: cleanSlots(f.slots, f.count, camIds) });
      if (fights.length >= MAX_FIGHTS) break;
    }
  }
  return { count: COUNTS.includes(r.count) ? r.count : 2, layouts, bgs, fights };
}

const slug = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pelea';
const camIdsOf = (state) => state.sources.filter((x) => x.kind !== 'vtr' && x.kind !== 'split').map((x) => x.id);
const clone = (x) => JSON.parse(JSON.stringify(x));
const withSlots = (state, fn) => {
  const n = state.split.count;
  const slots = fn(state.split.layouts[n]);
  return slots ? { ...state, split: { ...state.split, layouts: { ...state.split.layouts, [n]: slots } } } : state;
};

export function createState(config) {
  const sources = config.teams.map((t, i) => ({
    id: `cam${i + 1}`,
    label: t.name,
    kind: t.source?.kind ?? 'vdo',
    status: 'live',
    players: t.players,
    logo: t.logo ?? null,
  }));
  if (config.aerial) {
    sources.push({ id: `cam${sources.length + 1}`, label: config.aerial.name, kind: config.aerial.source.kind, status: 'live', players: undefined, logo: null });
  }
  const camIds = sources.map((x) => x.id);
  sources.push({ id: 'vtr', label: 'VTR', kind: 'vtr', status: 'live' });
  sources.push({ id: 'split', label: 'Pantalla dividida', kind: 'split', status: 'live' });
  return {
    sources,
    split: normalizeSplit(config.splitSaved, camIds),
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
        lastTake: { mode, from: state.program, to: state.preview, seq: (state.lastTake?.seq ?? 0) + 1 },
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
      return { ...state, vtr: { ...state.vtr, files, current, playing: kept ? state.vtr.playing : false }, split: { ...state.split, bgs } };
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
      const data = { team: src.label, player: src.players[state.gcPlayer] ?? src.players[0], logo: src.logo ?? null };
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
    case 'SPLIT_SET_CAM': {
      const n = state.split.count;
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= n || !camIdsOf(state).includes(action.cam)) return state;
      return withSlots(state, (slots) => slots.map((s, i) => (i === action.index ? { ...s, cam: action.cam } : s)));
    }
    case 'SPLIT_SET_RECT': {
      const n = state.split.count;
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= n) return state;
      const rect = clampRect(action);
      if (!rect) return state;
      return withSlots(state, (slots) => slots.map((s, i) => (i === action.index ? { cam: s.cam, ...rect } : s)));
    }
    case 'SPLIT_RESET_LAYOUT':
      return withSlots(state, (slots) => defaultSlots(state.split.count, camIdsOf(state)).map((d, i) => ({ ...d, cam: slots[i].cam })));
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
      const fight = { id: slug(name), name, count: n, slots: clone(state.split.layouts[n]) };
      const exists = state.split.fights.some((f) => f.id === fight.id);
      if (!exists && state.split.fights.length >= MAX_FIGHTS) return state;
      const fights = exists ? state.split.fights.map((f) => (f.id === fight.id ? fight : f)) : [...state.split.fights, fight];
      return { ...state, split: { ...state.split, fights } };
    }
    case 'SPLIT_LOAD_FIGHT': {
      const f = state.split.fights.find((x) => x.id === action.id);
      if (!f) return state;
      return { ...state, split: { ...state.split, count: f.count, layouts: { ...state.split.layouts, [f.count]: clone(f.slots) } } };
    }
    case 'SPLIT_DELETE_FIGHT': {
      const fights = state.split.fights.filter((f) => f.id !== action.id);
      return fights.length === state.split.fights.length ? state : { ...state, split: { ...state.split, fights } };
    }

    default:
      return state;
  }
}
