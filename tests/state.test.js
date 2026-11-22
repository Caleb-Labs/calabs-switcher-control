import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, reduce } from '../server/state.js';

const team = (i) => ({ name: `Equipo ${i}`, players: ['a', 'b'], source: { kind: 'vdo', room: `r${i}` } });
const config = { teams: Array.from({ length: 8 }, (_, i) => team(i + 1)) };

test('createState arma 9 fuentes, program=cam1 y preview=cam2', () => {
  const s = createState(config);
  assert.deepEqual(s.sources.map((x) => x.id), ['cam1','cam2','cam3','cam4','cam5','cam6','cam7','cam8','vtr']);
  assert.equal(s.program, 'cam1');
  assert.equal(s.preview, 'cam2');
  assert.equal(s.sources[8].kind, 'vtr');
  assert.equal(s.sources[0].label, 'Equipo 1');
});

test('TAKE cut intercambia preview y program y sube seq', () => {
  const s = reduce(createState(config), { type: 'TAKE', mode: 'cut' });
  assert.equal(s.program, 'cam2');
  assert.equal(s.preview, 'cam1');
  assert.deepEqual(s.lastTake, { mode: 'cut', from: 'cam1', to: 'cam2', seq: 1 });
});

test('TAKE con preview == program no cambia nada ni sube seq', () => {
  let s = reduce(createState(config), { type: 'SET_PREVIEW', id: 'cam1' });
  const after = reduce(s, { type: 'TAKE', mode: 'fade' });
  assert.equal(after.lastTake, null);
  assert.equal(after.program, 'cam1');
});

test('TAKE hacia una fuente nosignal igual corta (decide el operador)', () => {
  let s = createState(config);
  s = reduce(s, { type: 'SOURCE_STATUS', id: 'cam2', status: 'nosignal' });
  s = reduce(s, { type: 'TAKE', mode: 'cut' });
  assert.equal(s.program, 'cam2');
  assert.equal(s.sources[1].status, 'nosignal');
});

test('SET_AUDIO_MASTER ignora ids inexistentes', () => {
  let s = reduce(createState(config), { type: 'SET_AUDIO_MASTER', id: 'cam3' });
  assert.equal(s.audioMaster, 'cam3');
  s = reduce(s, { type: 'SET_AUDIO_MASTER', id: 'cam99' });
  assert.equal(s.audioMaster, 'cam3');
});

test('GC: arm -> preview, live -> live, off -> off, independiente de TAKE', () => {
  let s = reduce(createState(config), { type: 'GC_ARM', gcId: 'g1', template: 'gc-name', data: { team: 'X' } });
  assert.equal(s.gc.g1.state, 'preview');
  s = reduce(s, { type: 'GC_LIVE', gcId: 'g1' });
  assert.equal(s.gc.g1.state, 'live');
  s = reduce(s, { type: 'TAKE', mode: 'cut' });
  assert.equal(s.gc.g1.state, 'live');
  s = reduce(s, { type: 'GC_OFF', gcId: 'g1' });
  assert.equal(s.gc.g1.state, 'off');
});

test('EMERGENCY on/off', () => {
  let s = reduce(createState(config), { type: 'EMERGENCY', on: true });
  assert.equal(s.emergency, true);
  s = reduce(s, { type: 'EMERGENCY', on: false });
  assert.equal(s.emergency, false);
});

test('VTR: files, select, play, pause, next', () => {
  let s = reduce(createState(config), { type: 'VTR_FILES', files: ['a.mp4', 'b.png'] });
  s = reduce(s, { type: 'VTR_SELECT', file: 'a.mp4' });
  s = reduce(s, { type: 'VTR_PLAY' });
  assert.deepEqual(s.vtr, { files: ['a.mp4', 'b.png'], current: 'a.mp4', playing: true });
  s = reduce(s, { type: 'VTR_NEXT' });
  assert.equal(s.vtr.current, 'b.png');
  s = reduce(s, { type: 'VTR_PAUSE' });
  assert.equal(s.vtr.playing, false);
  s = reduce(s, { type: 'VTR_SELECT', file: 'nope.mp4' });
  assert.equal(s.vtr.current, 'b.png');
});

test('scoreboard: update limpia stale, STALE lo marca', () => {
  let s = reduce(createState(config), { type: 'SCOREBOARD_STALE' });
  assert.equal(s.scoreboard.stale, true);
  s = reduce(s, { type: 'SCOREBOARD_UPDATE', teams: [{ name: 'A', points: 3, position: 1 }] });
  assert.equal(s.scoreboard.stale, false);
  assert.equal(s.scoreboard.teams[0].name, 'A');
  assert.equal(typeof s.scoreboard.updatedAt, 'number');
});

test('el reducer no muta el estado de entrada y ignora acciones desconocidas', () => {
  const s = createState(config);
  const snapshot = JSON.stringify(s);
  reduce(s, { type: 'TAKE', mode: 'cut' });
  reduce(s, { type: 'GC_ARM', gcId: 'g', template: 't', data: {} });
  assert.equal(JSON.stringify(s), snapshot);
  assert.equal(reduce(s, { type: 'NOPE' }), s);
});

test('createState guarda emergencyLogo de la config (null si no hay)', () => {
  assert.equal(createState(config).emergencyLogo, null);
  assert.equal(createState({ ...config, emergencyLogo: '/vtr/e.png' }).emergencyLogo, '/vtr/e.png');
});

test('SCOREBOARD_UPDATE con los mismos datos y sin stale no genera un estado nuevo', () => {
  const teams = [{ name: 'A', points: 3, position: 1 }];
  const s1 = reduce(createState(config), { type: 'SCOREBOARD_UPDATE', teams });
  const s2 = reduce(s1, { type: 'SCOREBOARD_UPDATE', teams: [{ ...teams[0] }] });
  assert.equal(s2, s1);
  const stale = reduce(s1, { type: 'SCOREBOARD_STALE' });
  assert.equal(reduce(stale, { type: 'SCOREBOARD_STALE' }), stale);
  assert.equal(reduce(stale, { type: 'SCOREBOARD_UPDATE', teams }).scoreboard.stale, false);
});

test('audio master: solo cámaras; id null lo limpia; el vtr no puede ser master', () => {
  let s = reduce(createState(config), { type: 'SET_AUDIO_MASTER', id: 'cam2' });
  s = reduce(s, { type: 'SET_AUDIO_MASTER', id: 'vtr' });
  assert.equal(s.audioMaster, 'cam2');
  s = reduce(s, { type: 'SET_AUDIO_MASTER', id: null });
  assert.equal(s.audioMaster, null);
});
