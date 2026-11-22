// Comandos con nombre para el macropad (POST /api/do/<comando>). Cada uno es una acción del reducer.
const STEP = 0.05;
const table = {
  vtr: { type: 'SET_PREVIEW', id: 'vtr' },
  cut: { type: 'TAKE', mode: 'cut' },
  fade: { type: 'TAKE', mode: 'fade' },
  'preview-next': { type: 'PREVIEW_STEP', dir: 1 },
  'preview-prev': { type: 'PREVIEW_STEP', dir: -1 },
  'audio-next': { type: 'AUDIO_MASTER_STEP', dir: 1 },
  'audio-prev': { type: 'AUDIO_MASTER_STEP', dir: -1 },
  'audio-clear': { type: 'SET_AUDIO_MASTER', id: null },
  'vol-up': { type: 'ADJUST_VOLUME', target: 'cam', delta: STEP },
  'vol-down': { type: 'ADJUST_VOLUME', target: 'cam', delta: -STEP },
  mute: { type: 'TOGGLE_MUTE', target: 'cam' },
  'vtr-vol-up': { type: 'ADJUST_VOLUME', target: 'vtr', delta: STEP },
  'vtr-vol-down': { type: 'ADJUST_VOLUME', target: 'vtr', delta: -STEP },
  'vtr-mute': { type: 'TOGGLE_MUTE', target: 'vtr' },
  'vtr-play': { type: 'VTR_PLAY' },
  'vtr-pause': { type: 'VTR_PAUSE' },
  'vtr-toggle': { type: 'VTR_TOGGLE' },
  'vtr-next': { type: 'VTR_NEXT' },
  'vtr-prev': { type: 'VTR_PREV' },
  'gc-name-preview': { type: 'GC_NAME_PREVIEW' },
  'gc-name-live': { type: 'GC_LIVE', gcId: 'name' },
  'gc-name-off': { type: 'GC_OFF', gcId: 'name' },
  'gc-player-next': { type: 'GC_PLAYER_NEXT' },
  'gc-score-preview': { type: 'GC_ARM', gcId: 'score', template: 'scoreboard', data: {} },
  'gc-score-live': { type: 'GC_LIVE', gcId: 'score' },
  'gc-score-off': { type: 'GC_OFF', gcId: 'score' },
  'emergency-toggle': { type: 'EMERGENCY_TOGGLE' },
  'emergency-on': { type: 'EMERGENCY', on: true },
  'emergency-off': { type: 'EMERGENCY', on: false },
};
for (let i = 1; i <= 8; i++) table[`cam${i}`] = { type: 'SET_PREVIEW', id: `cam${i}` };

export const COMMANDS = Object.keys(table);

export function commandToAction(name) {
  if (typeof name !== 'string' || !Object.hasOwn(table, name)) return null;
  return structuredClone(table[name]);
}
