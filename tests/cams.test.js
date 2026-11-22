import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, reduce, persistable } from '../server/state.js';

const team = (i) => ({ name: `Equipo ${i}`, players: [`J${i}A`, `J${i}B`], source: { kind: 'vdo', room: `r${i}` } });
const config = { teams: Array.from({ length: 8 }, (_, i) => team(i + 1)), aerial: { name: 'Aérea', source: { kind: 'vdo', room: 'a' } } };
const S = (c = config) => createState(c);
const apply = (s, ...a) => a.reduce(reduce, s);
const activeIds = (s) => s.sources.filter((x) => x.active).map((x) => x.id);

test('al inicio todas las cámaras están activas; vtr y split siempre', () => {
  assert.deepEqual(activeIds(S()), ['cam1', 'cam2', 'cam3', 'cam4', 'cam5', 'cam6', 'cam7', 'cam8', 'cam9', 'vtr', 'split']);
  assert.equal(S().camCount, 9); // la aérea cuenta como una cámara más
  assert.equal(S().aerialOn, undefined);
  assert.deepEqual(S().camNames, {});
});

test('CAM_NAME pone un nombre personalizado (recortado a 30) y vacío vuelve al nombre por defecto', () => {
  let s = apply(S(), { type: 'CAM_NAME', id: 'cam3', name: '  Los Piratas  ' });
  assert.equal(s.sources[2].label, 'Los Piratas');
  assert.equal(s.camNames.cam3, 'Los Piratas');
  assert.equal(s.sources[2].team, 'Equipo 3'); // el equipo de los GC no cambia
  assert.equal(apply(s, { type: 'CAM_NAME', id: 'cam3', name: 'x'.repeat(80) }).sources[2].label.length, 30);
  s = apply(s, { type: 'CAM_NAME', id: 'cam3', name: '   ' });
  assert.equal(s.sources[2].label, 'Cámara 3');
  assert.equal(s.camNames.cam3, undefined);
  assert.equal(apply(S(), { type: 'CAM_NAME', id: 'cam9', name: 'Aérea' }).sources[8].label, 'Aérea');
  const s0 = S();
  for (const bad of [{ id: 'vtr', name: 'x' }, { id: 'split', name: 'x' }, { id: 'nope', name: 'x' }, { id: 'toString', name: 'x' }, { id: 'cam1', name: 5 }]) {
    assert.equal(apply(s0, { type: 'CAM_NAME', ...bad }), s0);
  }
});

test('SET_CAM_COUNT oculta las cámaras sobrantes; la aérea (cam9) se oculta como cualquier otra', () => {
  const s = apply(S(), { type: 'SET_CAM_COUNT', n: 4 });
  assert.deepEqual(activeIds(s), ['cam1', 'cam2', 'cam3', 'cam4', 'vtr', 'split']);
  assert.equal(s.camCount, 4);
  const s0 = S();
  for (const n of [0, 10, -1, 2.5, 'a', null]) assert.equal(apply(s0, { type: 'SET_CAM_COUNT', n }), s0);
  assert.equal(activeIds(apply(s, { type: 'SET_CAM_COUNT', n: 8 })).includes('cam9'), false);
  assert.equal(activeIds(apply(s, { type: 'SET_CAM_COUNT', n: 9 })).length, 11);
});

test('sin cámara aérea el máximo son los equipos; SET_AERIAL ya no existe', () => {
  const noAerial = S({ teams: config.teams });
  assert.equal(noAerial.camCount, 8);
  assert.equal(apply(noAerial, { type: 'SET_CAM_COUNT', n: 9 }), noAerial);
  const s0 = S();
  assert.equal(apply(s0, { type: 'SET_AERIAL', on: false }), s0);
});

test('las cámaras ocultas no se pueden elegir ni recorrer', () => {
  const s = apply(S(), { type: 'SET_CAM_COUNT', n: 3 });
  assert.equal(apply(s, { type: 'SET_PREVIEW', id: 'cam6' }), s);
  assert.equal(apply(s, { type: 'SET_AUDIO_MASTER', id: 'cam6' }).audioMaster, null);
  let p = apply(s, { type: 'SET_PREVIEW', id: 'cam3' });
  p = apply(p, { type: 'PREVIEW_STEP', dir: 1 });
  assert.equal(p.preview, 'vtr'); // salta las ocultas 4..9
  assert.equal(apply(s, { type: 'AUDIO_MASTER_STEP', dir: -1 }).audioMaster, 'cam3');
  assert.equal(apply(s, { type: 'SET_CAM_COUNT', n: 3 }, { type: 'MIX_SELECT', dir: -1 }).mixSel, 'cam3');
  assert.equal(apply(s, { type: 'SPLIT_SET_CAMS', cams: ['cam1', 'cam7'] }), s);
});

test('al ocultar una cámara en uso, program/preview/audio/mezclador/pantalla dividida se reacomodan', () => {
  let s = apply(S(), { type: 'SET_PREVIEW', id: 'cam6' }, { type: 'TAKE', mode: 'cut' }, { type: 'SET_PREVIEW', id: 'cam7' },
    { type: 'SET_AUDIO_MASTER', id: 'cam7' }, { type: 'MIX_TOGGLE', id: 'cam8' }, { type: 'SPLIT_SET_CAMS', cams: ['cam6', 'cam2'] });
  s = apply(s, { type: 'SET_CAM_COUNT', n: 4 });
  assert.ok(activeIds(s).includes(s.program) && activeIds(s).includes(s.preview));
  assert.equal(s.audioMaster, null);
  assert.equal(s.mix.cam8.on, false);
  assert.ok(activeIds(s).includes(s.mixSel));
  const cams = s.split.layouts[2].map((x) => x.cam);
  assert.ok(cams.every((c) => activeIds(s).includes(c)), cams.join());
  assert.equal(new Set(cams).size, 2);
  assert.equal(cams[1], 'cam2'); // la que seguía activa se conserva
});

test('nombres y cantidad se guardan en disco', () => {
  const s = apply(S(), { type: 'CAM_NAME', id: 'cam2', name: 'Capitanes' }, { type: 'SET_CAM_COUNT', n: 5 });
  const saved = JSON.parse(JSON.stringify(persistable(s)));
  const r = S({ ...config, saved });
  assert.equal(r.sources[1].label, 'Capitanes');
  assert.equal(r.camCount, 5);
  assert.ok(!activeIds(r).includes('cam9') && !activeIds(r).includes('cam6'));
  const bad = S({ ...config, saved: { camNames: { cam2: 5, nope: 'x', cam3: 'ok' }, camCount: 99 } });
  assert.equal(bad.camCount, 9);
  assert.equal(bad.sources[2].label, 'ok');
  assert.equal(bad.sources[1].label, 'Cámara 2');
});

test('archivos viejos (con aerialOn): equipos + aérea encendida = todas; aérea apagada = solo los equipos', () => {
  assert.equal(S({ ...config, saved: { camCount: 8, aerialOn: true } }).camCount, 9);
  assert.equal(S({ ...config, saved: { camCount: 8, aerialOn: false } }).camCount, 8);
  assert.equal(S({ ...config, saved: { camCount: 4, aerialOn: true } }).camCount, 4);
  assert.equal(S({ ...config, saved: { camCount: 9 } }).camCount, 9);
  assert.equal(S({ ...config, saved: { camCount: 6 } }).camCount, 6);
  assert.equal(persistable(S()).aerialOn, undefined);
});
