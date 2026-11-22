import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { createState, reduce } from '../server/state.js';
import { commandToAction, COMMANDS } from '../server/commands.js';
import { commandRoute } from '../server/api.js';
import { startServer } from '../server/index.js';
import { volumeFor } from '../public/shared/sources.js';
import { keyToAction } from '../public/control/keymap.js';
import { parseConfig } from '../server/config.js';

const team = (i) => ({ name: `Equipo ${i}`, players: [`J${i}A`, `J${i}B`], source: { kind: 'vdo', room: `r${i}` }, logo: i === 1 ? 'logos/e1.png' : undefined });
const config = { teams: Array.from({ length: 8 }, (_, i) => team(i + 1)) };
const S = (c = config) => createState(c);
const apply = (s, ...actions) => actions.reduce(reduce, s);

// ---------- volumen ----------
test('audio: nivel y mute separados para cámara master y VTR, con límites 0..1', () => {
  let s = S();
  assert.deepEqual(s.audio, { cam: { level: 1, muted: false }, vtr: { level: 1, muted: false } });
  s = apply(s, { type: 'ADJUST_VOLUME', target: 'cam', delta: -0.25 });
  assert.equal(s.audio.cam.level, 0.75);
  s = apply(s, { type: 'ADJUST_VOLUME', target: 'cam', delta: -5 });
  assert.equal(s.audio.cam.level, 0);
  s = apply(s, { type: 'ADJUST_VOLUME', target: 'vtr', delta: 5 });
  assert.equal(s.audio.vtr.level, 1);
  assert.equal(s.audio.cam.level, 0);
  const same = apply(s, { type: 'ADJUST_VOLUME', target: 'otro', delta: 0.1 });
  assert.equal(same, s);
  s = apply(s, { type: 'TOGGLE_MUTE', target: 'cam' });
  assert.equal(s.audio.cam.muted, true);
  s = apply(s, { type: 'TOGGLE_MUTE', target: 'cam' });
  assert.equal(s.audio.cam.muted, false);
});

test('volumeFor respeta nivel y mute', () => {
  let s = apply(S(), { type: 'SET_AUDIO_MASTER', id: 'cam3' }, { type: 'ADJUST_VOLUME', target: 'cam', delta: -0.5 });
  assert.equal(volumeFor(s, 'cam3'), 0.5);
  assert.equal(volumeFor(s, 'cam4'), 0);
  s = apply(s, { type: 'TOGGLE_MUTE', target: 'cam' });
  assert.equal(volumeFor(s, 'cam3'), 0);
  s = apply(S(), { type: 'SET_PREVIEW', id: 'vtr' }, { type: 'TAKE', mode: 'cut' }, { type: 'VTR_FILES', files: ['a.mp4'] }, { type: 'VTR_SELECT', file: 'a.mp4' }, { type: 'VTR_PLAY' }, { type: 'ADJUST_VOLUME', target: 'vtr', delta: -0.4 });
  assert.equal(volumeFor(s, 'vtr'), 0.6);
});

// ---------- navegación ----------
test('PREVIEW_STEP recorre las fuentes, da la vuelta y salta la que está al aire', () => {
  let s = S(); // program cam1, preview cam2
  s = apply(s, { type: 'PREVIEW_STEP', dir: 1 });
  assert.equal(s.preview, 'cam3');
  s = apply(s, { type: 'PREVIEW_STEP', dir: -1 }, { type: 'PREVIEW_STEP', dir: -1 });
  assert.equal(s.preview, 'vtr'); // cam2 -> cam1 (al aire, se salta) -> vtr (da la vuelta)
  s = apply(s, { type: 'PREVIEW_STEP', dir: 1 });
  assert.equal(s.preview, 'cam2'); // vtr -> cam1 (salta) -> cam2
});

test('AUDIO_MASTER_STEP recorre solo cámaras; sin master empieza en cam1 (+1) o cam8 (-1)', () => {
  assert.equal(apply(S(), { type: 'AUDIO_MASTER_STEP', dir: 1 }).audioMaster, 'cam1');
  assert.equal(apply(S(), { type: 'AUDIO_MASTER_STEP', dir: -1 }).audioMaster, 'cam8');
  let s = apply(S(), { type: 'SET_AUDIO_MASTER', id: 'cam8' }, { type: 'AUDIO_MASTER_STEP', dir: 1 });
  assert.equal(s.audioMaster, 'cam1');
  s = apply(s, { type: 'AUDIO_MASTER_STEP', dir: -1 });
  assert.equal(s.audioMaster, 'cam8');
});

test('VTR_PREV, VTR_NEXT y VTR_TOGGLE', () => {
  let s = apply(S(), { type: 'VTR_FILES', files: ['a.mp4', 'b.mp4', 'c.png'] }, { type: 'VTR_SELECT', file: 'a.mp4' });
  s = apply(s, { type: 'VTR_PREV' });
  assert.equal(s.vtr.current, 'c.png');
  s = apply(s, { type: 'VTR_TOGGLE' });
  assert.equal(s.vtr.playing, true);
  s = apply(s, { type: 'VTR_TOGGLE' });
  assert.equal(s.vtr.playing, false);
  const none = apply(S(), { type: 'VTR_TOGGLE' });
  assert.equal(none.vtr.playing, false);
  assert.equal(apply(S(), { type: 'VTR_PREV' }).vtr.current, null);
});

test('EMERGENCY_TOGGLE alterna', () => {
  let s = apply(S(), { type: 'EMERGENCY_TOGGLE' });
  assert.equal(s.emergency, true);
  assert.equal(apply(s, { type: 'EMERGENCY_TOGGLE' }).emergency, false);
});

// ---------- GC del equipo en preview ----------
test('las fuentes llevan jugadores y logo del equipo; el VTR no', () => {
  const s = S();
  assert.deepEqual(s.sources[0].players, ['J1A', 'J1B']);
  assert.equal(s.sources[0].logo, 'logos/e1.png');
  assert.equal(s.sources[1].logo, null);
  assert.equal(s.sources[8].players, undefined);
});

test('GC_NAME_PREVIEW arma el GC con el equipo que está en preview y el jugador elegido', () => {
  let s = apply(S(), { type: 'SET_PREVIEW', id: 'cam1' }); // cam1 está al aire; usar cam3
  s = apply(S(), { type: 'SET_PREVIEW', id: 'cam3' }, { type: 'GC_NAME_PREVIEW' });
  assert.deepEqual(s.gc.name, { template: 'gc-name', data: { team: 'Equipo 3', player: 'J3A', logo: null }, state: 'preview' });
  s = apply(s, { type: 'GC_PLAYER_NEXT' }, { type: 'GC_NAME_PREVIEW' });
  assert.equal(s.gc.name.data.player, 'J3B');
  s = apply(s, { type: 'GC_PLAYER_NEXT' });
  assert.equal(s.gcPlayer, 0);
});

test('GC_NAME_PREVIEW con el VTR en preview no hace nada', () => {
  const s = apply(S(), { type: 'SET_PREVIEW', id: 'vtr' });
  assert.equal(apply(s, { type: 'GC_NAME_PREVIEW' }), s);
});

// ---------- VTR por defecto ----------
test('vtrDefault: se elige solo al aparecer la lista y como respaldo si se borra el archivo actual', () => {
  const cfg = { ...config, vtrDefault: 'standby.png' };
  let s = apply(S(cfg), { type: 'VTR_FILES', files: ['@tabla', 'a.mp4', 'standby.png'] });
  assert.equal(s.vtr.current, 'standby.png');
  assert.equal(s.vtr.playing, false);
  s = apply(s, { type: 'VTR_SELECT', file: 'a.mp4' }, { type: 'VTR_PLAY' }, { type: 'VTR_FILES', files: ['@tabla', 'standby.png'] });
  assert.equal(s.vtr.current, 'standby.png');
  assert.equal(s.vtr.playing, false);
  assert.equal(apply(S(cfg), { type: 'VTR_FILES', files: ['a.mp4'] }).vtr.current, null);
  assert.equal(apply(S(), { type: 'VTR_FILES', files: ['a.mp4'] }).vtr.current, null);
});

test('parseConfig conserva vtrDefault', () => {
  const eight = config.teams;
  assert.equal(parseConfig({ teams: eight, vtrDefault: 'standby.png' }).vtrDefault, 'standby.png');
  assert.equal(parseConfig({ teams: eight }).vtrDefault, null);
});

// ---------- comandos (macropad por HTTP) ----------
test('commandToAction: cámaras, corte, navegación, volumen, VTR, GC, emergencia', () => {
  assert.deepEqual(commandToAction('cam3'), { type: 'SET_PREVIEW', id: 'cam3' });
  assert.deepEqual(commandToAction('vtr'), { type: 'SET_PREVIEW', id: 'vtr' });
  assert.deepEqual(commandToAction('cut'), { type: 'TAKE', mode: 'cut' });
  assert.deepEqual(commandToAction('fade'), { type: 'TAKE', mode: 'fade' });
  assert.deepEqual(commandToAction('preview-next'), { type: 'PREVIEW_STEP', dir: 1 });
  assert.deepEqual(commandToAction('preview-prev'), { type: 'PREVIEW_STEP', dir: -1 });
  assert.deepEqual(commandToAction('audio-next'), { type: 'AUDIO_MASTER_STEP', dir: 1 });
  assert.deepEqual(commandToAction('audio-clear'), { type: 'SET_AUDIO_MASTER', id: null });
  assert.deepEqual(commandToAction('vol-up'), { type: 'ADJUST_VOLUME', target: 'cam', delta: 0.05 });
  assert.deepEqual(commandToAction('vol-down'), { type: 'ADJUST_VOLUME', target: 'cam', delta: -0.05 });
  assert.deepEqual(commandToAction('mute'), { type: 'TOGGLE_MUTE', target: 'cam' });
  assert.deepEqual(commandToAction('vtr-vol-up'), { type: 'ADJUST_VOLUME', target: 'vtr', delta: 0.05 });
  assert.deepEqual(commandToAction('vtr-mute'), { type: 'TOGGLE_MUTE', target: 'vtr' });
  assert.deepEqual(commandToAction('vtr-toggle'), { type: 'VTR_TOGGLE' });
  assert.deepEqual(commandToAction('vtr-prev'), { type: 'VTR_PREV' });
  assert.deepEqual(commandToAction('gc-name-preview'), { type: 'GC_NAME_PREVIEW' });
  assert.deepEqual(commandToAction('gc-name-live'), { type: 'GC_LIVE', gcId: 'name' });
  assert.deepEqual(commandToAction('gc-name-off'), { type: 'GC_OFF', gcId: 'name' });
  assert.deepEqual(commandToAction('gc-player-next'), { type: 'GC_PLAYER_NEXT' });
  assert.deepEqual(commandToAction('gc-score-preview'), { type: 'GC_ARM', gcId: 'score', template: 'scoreboard', data: {} });
  assert.deepEqual(commandToAction('gc-score-live'), { type: 'GC_LIVE', gcId: 'score' });
  assert.deepEqual(commandToAction('emergency-toggle'), { type: 'EMERGENCY_TOGGLE' });
  assert.deepEqual(commandToAction('emergency-on'), { type: 'EMERGENCY', on: true });
});

test('commandToAction: desconocidos o heredados -> null; COMMANDS lista los nombres', () => {
  for (const n of ['nope', '', 'cam9', 'cam0', 'toString', '__proto__', undefined]) assert.equal(commandToAction(n), null);
  assert.ok(COMMANDS.includes('cut') && COMMANDS.includes('cam8') && COMMANDS.includes('vtr-toggle'));
});

// ---------- HTTP /api/do y origen ----------
const srv = await startServer({
  port: 0, config, publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  extraRoutes: [commandRoute()],
});
after(() => srv.close());
const url = (p) => `http://127.0.0.1:${srv.port}${p}`;

test('POST /api/do/<comando> ejecuta la acción', async () => {
  const res = await fetch(url('/api/do/preview-next'), { method: 'POST' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
  assert.equal(srv.getState().preview, 'cam3');
  await fetch(url('/api/do/cut'), { method: 'POST' });
  assert.equal(srv.getState().program, 'cam3');
});

test('/api/do: GET -> 405, comando desconocido -> 404, Origin ajeno -> 403 y no ejecuta nada', async () => {
  const before = srv.getState().program;
  assert.equal((await fetch(url('/api/do/cut'))).status, 405);
  assert.equal((await fetch(url('/api/do/nope'), { method: 'POST' })).status, 404);
  const evil = await fetch(url('/api/do/cut'), { method: 'POST', headers: { origin: 'https://evil.example' } });
  assert.equal(evil.status, 403);
  assert.equal(srv.getState().program, before);
  const same = await fetch(url('/api/do/emergency-off'), { method: 'POST', headers: { origin: `http://127.0.0.1:${srv.port}` } });
  assert.equal(same.status, 200);
});

test('WebSocket: un Origin ajeno es rechazado; sin Origin o del mismo host, aceptado', async () => {
  const open = (headers) => new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`, { headers });
    ws.on('open', () => { ws.close(); resolve('open'); });
    ws.on('error', () => resolve('rejected'));
    ws.on('unexpected-response', () => resolve('rejected'));
  });
  assert.equal(await open({ origin: 'https://evil.example' }), 'rejected');
  assert.equal(await open({}), 'open');
  assert.equal(await open({ origin: `http://127.0.0.1:${srv.port}` }), 'open');
});

// ---------- teclado extra ----------
test('keyToAction: teclas extra de navegación y volumen', () => {
  assert.deepEqual(keyToAction(']'), { type: 'PREVIEW_STEP', dir: 1 });
  assert.deepEqual(keyToAction('['), { type: 'PREVIEW_STEP', dir: -1 });
  assert.deepEqual(keyToAction('='), { type: 'ADJUST_VOLUME', target: 'cam', delta: 0.05 });
  assert.deepEqual(keyToAction('-'), { type: 'ADJUST_VOLUME', target: 'cam', delta: -0.05 });
  assert.deepEqual(keyToAction('m'), { type: 'TOGGLE_MUTE', target: 'cam' });
  assert.deepEqual(keyToAction('.'), { type: 'VTR_NEXT' });
  assert.deepEqual(keyToAction(','), { type: 'VTR_PREV' });
  assert.deepEqual(keyToAction('p'), { type: 'VTR_TOGGLE' });
});
