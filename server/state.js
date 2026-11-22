// Estado puro del switcher. Sin efectos: reduce(state, action) devuelve un estado nuevo.

export function createState(config) {
  const sources = config.teams.map((t, i) => ({
    id: `cam${i + 1}`,
    label: t.name,
    kind: t.source?.kind ?? 'vdo',
    status: 'live',
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
      const current = files.includes(state.vtr.current) ? state.vtr.current : null;
      return { ...state, vtr: { ...state.vtr, files, current, playing: current ? state.vtr.playing : false } };
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
