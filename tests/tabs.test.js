import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { initTabs, isTab, TABS, DEFAULT_TAB } from '../public/control/tabs.js';

const html = fs.readFileSync(new URL('../public/control/index.html', import.meta.url), 'utf8');
const dom = () => parseHTML(html).document;

test('isTab reconoce solo páginas que existen', () => {
  assert.equal(isTab('audio'), true);
  assert.equal(isTab('nada'), false);
  assert.equal(isTab(null), false);
  assert.ok(TABS.includes(DEFAULT_TAB));
});

test('el HTML del panel no repite ids y trae lo que el JS busca', () => {
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
  for (const id of ['btn-cut', 'btn-fade', 'btn-emergency', 'mv', 'splitpanel', 'vtrpanel', 'connpanel', 'gcpanel', 'gcstyle', 'mixer', 'em-file', 'em-upload', 'cam-count', 'safe-on', 'sz-big', 'fade-ms']) {
    assert.ok(ids.includes(id), `falta #${id}`);
  }
});

test('la emergencia está arriba, en la barra fija, y no dentro de ninguna página', () => {
  const d = dom();
  assert.ok(d.querySelector('#bar #btn-emergency'));
  assert.equal(d.querySelector('#pages #btn-emergency'), null);
});

test('cada pestaña de la barra tiene su página y cada página su pestaña', () => {
  const d = dom();
  const tabs = [...d.querySelectorAll('#tabs .tab')].map((b) => b.getAttribute('data-tab')).sort();
  const pages = [...d.querySelectorAll('#pages .page')].map((p) => p.getAttribute('data-page')).sort();
  assert.deepEqual(tabs, pages);
  assert.deepEqual(tabs, [...TABS].sort());
});

test('el multiview queda fuera de las páginas (siempre visible)', () => {
  const d = dom();
  assert.ok(d.querySelector('#mv'));
  assert.equal(d.querySelector('#pages #mv'), null);
});

test('initTabs arranca en el Mezclador y mostrar una pestaña oculta las demás', () => {
  const d = dom();
  assert.equal(initTabs(d), DEFAULT_TAB);
  const visible = () => [...d.querySelectorAll('#pages .page')].filter((p) => !p.hidden).map((p) => p.getAttribute('data-page'));
  assert.deepEqual(visible(), ['mezclador']);
  d.querySelector('[data-tab="audio"]').onclick();
  assert.deepEqual(visible(), ['audio']);
  assert.ok(d.querySelector('[data-tab="audio"]').classList.contains('active'));
  assert.ok(!d.querySelector('[data-tab="mezclador"]').classList.contains('active'));
  d.querySelector('[data-tab="ajustes"]').onclick();
  assert.deepEqual(visible(), ['ajustes']);
});

test('cada sección está en la pestaña que le toca', () => {
  const d = dom();
  const pageOf = (sel) => d.querySelector(sel)?.closest('.page')?.getAttribute('data-page');
  assert.equal(pageOf('#splitpanel'), 'camaras');
  assert.equal(pageOf('#connpanel'), 'conexion');
  assert.equal(pageOf('#mixer'), 'audio');
  assert.equal(pageOf('#vtrpanel'), 'multimedia');
  assert.equal(pageOf('#em-file'), 'multimedia');
  assert.equal(pageOf('#gcpanel'), 'gc');
  assert.equal(pageOf('#gcstyle'), 'gc');
  assert.equal(pageOf('#cam-count'), 'ajustes');
  assert.equal(pageOf('#safe-on'), 'ajustes');
  assert.equal(pageOf('#sz-big'), 'ajustes');
});
