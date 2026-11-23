// Comandos con nombre para el macropad (POST /api/do/<comando>). Cada uno es una acción del reducer.
const STEP = 0.05;
const table = {
  vtr: { type: 'SET_PREVIEW', id: 'vtr' },
  split: { type: 'SET_PREVIEW', id: 'split' },
  cut: { type: 'TAKE', mode: 'cut' },
  fade: { type: 'TAKE', mode: 'fade' },
  stinger: { type: 'STINGER_PLAY' },
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
  'fade-longer': { type: 'FADE_STEP', dir: 1 },
  'fade-shorter': { type: 'FADE_STEP', dir: -1 },
  'mix-next': { type: 'MIX_SELECT', dir: 1 },
  'mix-prev': { type: 'MIX_SELECT', dir: -1 },
  'mix-up': { type: 'MIX_ADJUST', delta: STEP },
  'mix-down': { type: 'MIX_ADJUST', delta: -STEP },
  'mix-toggle': { type: 'MIX_SEL_TOGGLE' },
  'test-tone': { type: 'TEST_TONE' },
  'split-gc-preview': { type: 'SPLIT_GC', to: 'preview' },
  'split-gc-live': { type: 'SPLIT_GC', to: 'live' },
  'split-gc-off': { type: 'SPLIT_GC', to: 'off' },
  'gc-score-live': { type: 'GC_LIVE', gcId: 'score' },
  'gc-score-off': { type: 'GC_OFF', gcId: 'score' },
  'emergency-toggle': { type: 'EMERGENCY_TOGGLE' },
  'emergency-on': { type: 'EMERGENCY', on: true },
  'emergency-off': { type: 'EMERGENCY', on: false },
};
for (let i = 1; i <= 9; i++) table[`cam${i}`] = { type: 'SET_PREVIEW', id: `cam${i}` };

export const COMMANDS = Object.keys(table);

export function commandToAction(name) {
  if (typeof name !== 'string' || !Object.hasOwn(table, name)) return null;
  return structuredClone(table[name]);
}
