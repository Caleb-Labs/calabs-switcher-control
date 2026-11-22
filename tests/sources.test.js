import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createSourceElement, mountOnly, neededIds } from '../public/shared/sources.js';

const setup = () => {
  const dom = new JSDOM('<div id="c"></div>');
  global.document = dom.window.document;
  return dom.window.document.getElementById('c');
};
const create = (id) => createSourceElement({ id, kind: 'vdo' }, { url: `https://vdo.ninja/?view=${id}` });
const mounted = (c) => [...c.children].map((e) => e.dataset.sourceId).sort();

test('neededIds: solo la fuente al aire; durante el fade también la saliente', () => {
  const state = { program: 'cam2', lastTake: { mode: 'fade', from: 'cam1', to: 'cam2', seq: 1 } };
  assert.deepEqual(neededIds(state, false), ['cam2']);
  assert.deepEqual(neededIds(state, true), ['cam2', 'cam1']);
  assert.deepEqual(neededIds({ program: 'cam3', lastTake: null }, true), ['cam3']);
});

test('mountOnly monta/desmonta y nunca deja más de las fuentes pedidas', () => {
  const c = setup();
  mountOnly(c, ['cam1'], create);
  assert.deepEqual(mounted(c), ['cam1']);
  mountOnly(c, ['cam2', 'cam1'], create);
  assert.deepEqual(mounted(c), ['cam1', 'cam2']);
  const first = c.querySelector('[data-source-id="cam1"]');
  mountOnly(c, ['cam2'], create);
  assert.deepEqual(mounted(c), ['cam2']);
  assert.ok(!c.contains(first));
});

test('mountOnly no recrea un iframe que ya está montado (no reconecta a la cámara)', () => {
  const c = setup();
  mountOnly(c, ['cam1'], create);
  const el = c.firstElementChild;
  mountOnly(c, ['cam1'], create);
  assert.equal(c.firstElementChild, el);
});

test('createSourceElement: iframe para vdo/twitch, video para vtr', () => {
  setup();
  const f = createSourceElement({ id: 'cam1', kind: 'vdo' }, { url: 'https://vdo.ninja/?view=x' });
  assert.equal(f.tagName, 'IFRAME');
  assert.equal(f.getAttribute('src'), 'https://vdo.ninja/?view=x');
  assert.equal(f.dataset.sourceId, 'cam1');
  const v = createSourceElement({ id: 'vtr', kind: 'vtr' }, {});
  assert.equal(v.tagName, 'VIDEO');
});
