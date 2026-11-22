import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyToAction } from '../public/control/keymap.js';
import { assignAreas } from '../public/control/layout.js';

test('keyToAction: 1-8 eligen cámara en preview, 9 el VTR', () => {
  assert.deepEqual(keyToAction('3'), { type: 'SET_PREVIEW', id: 'cam3' });
  assert.deepEqual(keyToAction('8'), { type: 'SET_PREVIEW', id: 'cam8' });
  assert.deepEqual(keyToAction('9'), { type: 'SET_PREVIEW', id: 'vtr' });
});

test('keyToAction: Enter = CUT, Espacio = FADE', () => {
  assert.deepEqual(keyToAction('Enter'), { type: 'TAKE', mode: 'cut' });
  assert.deepEqual(keyToAction(' '), { type: 'TAKE', mode: 'fade' });
});

test('keyToAction: teclas desconocidas -> null', () => {
  for (const k of ['0', 'a', 'Escape', '', undefined, '10']) assert.equal(keyToAction(k), null);
});

const ids = ['cam1', 'cam2', 'cam3', 'cam4', 'cam5', 'cam6', 'cam7', 'cam8', 'vtr'];
const state = (program, preview) => ({ program, preview, sources: ids.map((id) => ({ id })) });

test('assignAreas: program y preview ocupan los slots grandes, el resto su slot chico', () => {
  const a = assignAreas(state('cam1', 'cam2'));
  assert.equal(a.cam1, 'pgm');
  assert.equal(a.cam2, 'pre');
  assert.equal(a.cam3, 's-cam3');
  assert.equal(a.vtr, 's-vtr');
});

test('assignAreas: cada fuente tiene exactamente un área y nunca se repite una grande', () => {
  const a = assignAreas(state('vtr', 'cam8'));
  assert.equal(Object.keys(a).length, 9);
  assert.equal(Object.values(a).filter((v) => v === 'pgm').length, 1);
  assert.equal(Object.values(a).filter((v) => v === 'pre').length, 1);
});

test('assignAreas: si preview == program, program gana y no se duplica', () => {
  const a = assignAreas(state('cam4', 'cam4'));
  assert.equal(a.cam4, 'pgm');
  assert.equal(Object.values(a).filter((v) => v === 'pre').length, 0);
});
