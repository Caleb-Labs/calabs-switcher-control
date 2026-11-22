import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, reduce, normalizeSplit } from '../server/state.js';
import { volumeFor, neededIds, audibleCams } from '../public/shared/sources.js';

const team = (i) => ({ name: `Equipo ${i}`, players: ['a', 'b'], source: { kind: 'vdo', room: `sala${i}` } });
const config = { teams: Array.from({ length: 8 }, (_, i) => team(i + 1)) };
const S = () => createState(config);
const apply = (s, ...a) => a.reduce(reduce, s);
const onAir = (s) => ({ ...s, program: 'split', preview: 'cam5' });

test('SPLIT_AUDIO_TOGGLE marca qué recuadros aportan audio cuando la dividida está al aire', () => {
  assert.deepEqual(S().split.audioOn[2], [false, false]);
  let s = apply(S(), { type: 'SPLIT_AUDIO_TOGGLE', index: 1 });
  assert.deepEqual(s.split.audioOn[2], [false, true]);
  s = apply(s, { type: 'SPLIT_AUDIO_TOGGLE', index: 1 });
  assert.deepEqual(s.split.audioOn[2], [false, false]);
  const s0 = S();
  for (const index of [-1, 2, 9, 'a', 0.5]) assert.equal(apply(s0, { type: 'SPLIT_AUDIO_TOGGLE', index }), s0);
});

test('con la dividida al aire y recuadros con audio, solo suenan esas cámaras (el mezclador se pausa)', () => {
  let s = apply(S(), { type: 'MIX_TOGGLE', id: 'cam7' }, { type: 'SPLIT_SET_CAMS', cams: ['cam3', 'cam4'] }, { type: 'SPLIT_AUDIO_TOGGLE', index: 0 });
  const air = onAir(s);
  assert.deepEqual(audibleCams(air), ['cam3']);
  assert.equal(volumeFor(air, 'cam3'), 1);
  assert.equal(volumeFor(air, 'cam4'), 0);
  assert.equal(volumeFor(air, 'cam7'), 0);
  // fuera de la dividida vuelve la selección del mezclador, tal como estaba
  const normal = { ...s, program: 'cam1', preview: 'split' };
  assert.deepEqual(audibleCams(normal), ['cam7']);
  assert.equal(volumeFor(normal, 'cam7'), 1);
  assert.equal(volumeFor(normal, 'cam3'), 0);
});

test('si la dividida no tiene audio elegido, sigue sonando lo del mezclador', () => {
  const s = apply(S(), { type: 'MIX_TOGGLE', id: 'cam7' }, { type: 'SPLIT_SET_CAMS', cams: ['cam3', 'cam4'] });
  assert.deepEqual(audibleCams(onAir(s)), ['cam7']);
});

test('el nivel de cada cámara y el general se respetan también con el audio de la dividida', () => {
  let s = apply(S(), { type: 'SPLIT_SET_CAMS', cams: ['cam3', 'cam4'] }, { type: 'SPLIT_AUDIO_TOGGLE', index: 0 }, { type: 'MIX_LEVEL', id: 'cam3', level: 0.5 }, { type: 'SET_VOLUME', target: 'cam', level: 0.5 });
  assert.equal(volumeFor(onAir(s), 'cam3'), 0.25);
});

test('neededIds incluye las cámaras con audio de la dividida', () => {
  const s = onAir(apply(S(), { type: 'SPLIT_SET_CAMS', cams: ['cam3', 'cam4'] }, { type: 'SPLIT_AUDIO_TOGGLE', index: 1 }));
  const ids = neededIds({ ...s, lastTake: null }, false);
  assert.ok(ids.includes('cam4') && ids.includes('cam3'));
});

test('las peleas guardan y recuperan el audio elegido; los datos corruptos se reparan', () => {
  let s = apply(S(), { type: 'SPLIT_AUDIO_TOGGLE', index: 0 }, { type: 'SPLIT_SAVE_FIGHT', name: 'P1' });
  const id = s.split.fights[0].id;
  s = apply(s, { type: 'SPLIT_AUDIO_TOGGLE', index: 0 }, { type: 'SPLIT_AUDIO_TOGGLE', index: 1 }, { type: 'SPLIT_LOAD_FIGHT', id });
  assert.deepEqual(s.split.audioOn[2], [true, false]);
  const sp = normalizeSplit({ audioOn: { 2: [true, 'x', null], 3: 'nope' } }, ['cam1', 'cam2', 'cam3']);
  assert.deepEqual(sp.audioOn[2], [true, false]);
  assert.equal(sp.audioOn[3].length, 3);
  assert.ok(sp.audioOn[3].every((v) => v === false));
});
