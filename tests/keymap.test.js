import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyToAction, shouldHandleKey } from '../public/control/keymap.js';
import { assignAreas, gridTemplate, clampSizes, bigColsFor, badgeText, DEFAULT_SIZES } from '../public/control/layout.js';

test('keyToAction: 1-9 eligen cámara (9 = aérea), 0 el VTR, s la pantalla dividida', () => {
  assert.deepEqual(keyToAction('3'), { type: 'SET_PREVIEW', id: 'cam3' });
  assert.deepEqual(keyToAction('8'), { type: 'SET_PREVIEW', id: 'cam8' });
  assert.deepEqual(keyToAction('9'), { type: 'SET_PREVIEW', id: 'cam9' });
  assert.deepEqual(keyToAction('0'), { type: 'SET_PREVIEW', id: 'vtr' });
  assert.deepEqual(keyToAction('s'), { type: 'SET_PREVIEW', id: 'split' });
});

test('keyToAction: Espacio = CUT, Enter = FADE', () => {
  assert.deepEqual(keyToAction(' '), { type: 'TAKE', mode: 'cut' });
  assert.deepEqual(keyToAction('Enter'), { type: 'TAKE', mode: 'fade' });
});

test('keyToAction: teclas desconocidas -> null', () => {
  for (const k of ['a', 'Escape', '', undefined, '10']) assert.equal(keyToAction(k), null);
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

test('clampSizes: valor por defecto, límites y basura (tamaño relativo a la ventana, no en píxeles)', () => {
  assert.deepEqual(clampSizes(undefined), DEFAULT_SIZES);
  assert.deepEqual(clampSizes({ bigShare: 5 }), { bigShare: 0.5 });
  assert.deepEqual(clampSizes({ bigShare: 0.01 }), { bigShare: 0.2 });
  assert.deepEqual(clampSizes({ bigShare: '0.4' }), { bigShare: 0.4 });
  assert.deepEqual(clampSizes({ bigShare: 'x' }), DEFAULT_SIZES);
  assert.deepEqual(clampSizes({ bigShare: null }), DEFAULT_SIZES);
});

test('bigColsFor convierte la proporción en columnas según cuántas fuentes hay (2 columnas por tile)', () => {
  assert.equal(bigColsFor(0.5, 9), 9);
  assert.equal(bigColsFor(0.33, 11), 7);
  assert.equal(bigColsFor(0.2, 4), 2);
  assert.equal(bigColsFor(0.5, 11), 11);
});

test('el tamaño por defecto deja a Preview y Program bastante menores que media pantalla', () => {
  assert.ok(DEFAULT_SIZES.bigShare < 0.45);
});

test('badgeText: nombre de la ventana + de la fuente solo en preview/program', () => {
  assert.equal(badgeText('pgm', 'Equipo 1'), 'PROGRAM · Equipo 1');
  assert.equal(badgeText('pre', 'Equipo 2'), 'PREVIEW · Equipo 2');
  assert.equal(badgeText('s-cam3', 'Equipo 3'), '');
});

test('keyToAction: t lanza la transición (stinger)', () => {
  assert.deepEqual(keyToAction('t'), { type: 'STINGER_PLAY' });
});
