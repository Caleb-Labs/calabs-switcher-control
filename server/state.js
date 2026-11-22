// Estado puro del switcher. Sin efectos: reduce(state, action) devuelve un estado nuevo.

export function createState(config) {
  const sources = config.teams.map((t, i) => ({
    id: `cam${i + 1}`,
    label: t.name,
    kind: t.source?.kind ?? 'vdo',
    status: 'live',
    players: t.players,
    logo: t.logo ?? null,
  }));
  sources.push({ id: 'vtr', label: 'VTR', kind: 'vtr', status: 'live' });
  return {
    sources,
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
      return hasSource(state, action.id) && action.id !== 'vtr' ? { ...state, audioMaster: action.id } : state;

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
      return { ...state, vtr: { ...state.vtr, files, current, playing: kept ? state.vtr.playing : false } };
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
      const cams = state.sources.filter((x) => x.kind !== 'vtr').map((x) => x.id);
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

    default:
      return state;
  }
}
