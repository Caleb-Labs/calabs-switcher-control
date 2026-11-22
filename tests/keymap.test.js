import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyToAction, shouldHandleKey } from '../public/control/keymap.js';
import { assignAreas, gridTemplate, clampSizes, badgeText, DEFAULT_SIZES } from '../public/control/layout.js';

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

test('shouldHandleKey: ignora repeticiones, combinaciones con Ctrl/Alt/Meta y campos de texto', () => {
  assert.equal(shouldHandleKey({ key: 'Enter', repeat: false }), true);
  assert.equal(shouldHandleKey({ key: 'Enter', repeat: true }), false);
  assert.equal(shouldHandleKey({ key: '1', ctrlKey: true }), false);
  assert.equal(shouldHandleKey({ key: '1', altKey: true }), false);
  assert.equal(shouldHandleKey({ key: '1', metaKey: true }), false);
  assert.equal(shouldHandleKey({ key: '1', target: { closest: () => ({}) } }), false);
  assert.equal(shouldHandleKey({ key: '1', target: { closest: () => null } }), true);
});

const ids9 = ['cam1', 'cam2', 'cam3', 'cam4', 'cam5', 'cam6', 'cam7', 'cam8', 'vtr'];
const cells = (row) => row.replace(/"/g, '').split(' ');

test('gridTemplate: 18 columnas; preview y program ocupan bigCols cada uno y el resto queda vacío', () => {
  const [top, bottom] = gridTemplate(ids9, 5).match(/"[^"]+"/g).map(cells);
  assert.equal(top.length, 18);
  assert.equal(top.filter((c) => c === 'pre').length, 5);
  assert.equal(top.filter((c) => c === 'pgm').length, 5);
  assert.equal(top.filter((c) => c === '.').length, 8);
  assert.deepEqual(top.slice(0, 5), ['pre', 'pre', 'pre', 'pre', 'pre']);
  assert.equal(bottom.length, 18);
  assert.deepEqual(bottom.slice(0, 4), ['s-cam1', 's-cam1', 's-cam2', 's-cam2']);
});

test('gridTemplate con bigCols 9 llena toda la fila (como el diseño original)', () => {
  const [top] = gridTemplate(ids9, 9).match(/"[^"]+"/g).map(cells);
  assert.equal(top.filter((c) => c === '.').length, 0);
});

test('clampSizes: valores por defecto, límites y basura', () => {
  assert.deepEqual(clampSizes(undefined), DEFAULT_SIZES);
  assert.deepEqual(clampSizes({ bigCols: 99, smallPx: 5 }), { bigCols: 9, smallPx: 100 });
  assert.deepEqual(clampSizes({ bigCols: 1, smallPx: 9999 }), { bigCols: 4, smallPx: 260 });
  assert.deepEqual(clampSizes({ bigCols: '6', smallPx: '180' }), { bigCols: 6, smallPx: 180 });
  assert.deepEqual(clampSizes({ bigCols: 'x', smallPx: null }), DEFAULT_SIZES);
});

test('los tamaños por defecto son más chicos que antes (preview/program ya no ocupan media pantalla)', () => {
  assert.ok(DEFAULT_SIZES.bigCols < 9);
});

test('badgeText: nombre de la ventana + de la fuente solo en preview/program', () => {
  assert.equal(badgeText('pgm', 'Equipo 1'), 'PROGRAM · Equipo 1');
  assert.equal(badgeText('pre', 'Equipo 2'), 'PREVIEW · Equipo 2');
  assert.equal(badgeText('s-cam3', 'Equipo 3'), '');
});
