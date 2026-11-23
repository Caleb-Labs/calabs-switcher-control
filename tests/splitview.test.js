import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { renderSplitView } from '../public/control/splitview.js';

const { document } = parseHTML('<div id="v"></div>');
globalThis.document = document;
const mk = (extra = {}) => ({
  sources: [{ id: 'cam1', label: 'A', status: 'live' }, { id: 'cam2', label: 'B', status: 'live' }, { id: 'cam3', label: 'C', status: 'live' }, ...(extra.sources ?? [])],
  split: { count: 2, bgs: {}, layouts: { 2: [{ cam: 'cam1', x: 0, y: 0, w: 0.5, h: 0.5 }, { cam: 'cam2', x: 0.5, y: 0, w: 0.5, h: 0.5 }] } },
});
const fresh = () => { const el = document.createElement('div'); document.body.append(el); return el; };

test('sin videos, la vista de la dividida es solo el esquema (cajas con nombre)', () => {
  const el = fresh(); renderSplitView(el, mk());
  assert.equal(el.querySelectorAll('.sv-box').length, 2);
  assert.equal(el.querySelectorAll('iframe').length, 0);
});

test('con videos, cada cámara de la dividida abre su iframe en su recuadro (sin sala o sin señal no)', () => {
  const urls = { cam1: 'https://vdo.ninja/?view=a', cam2: null, cam3: 'https://vdo.ninja/?view=c' };
  const el = fresh(); renderSplitView(el, mk(), urls);
  const f = [...el.querySelectorAll('iframe')];
  assert.equal(f.length, 1); // cam2 sin sala, cam3 no está en la dividida
  assert.equal(f[0].getAttribute('src'), urls.cam1);
  assert.equal(f[0].style.left, '0%'); assert.equal(f[0].style.width, '50%');
  const ns = mk(); ns.sources[0].status = 'nosignal';
  const el2 = fresh(); renderSplitView(el2, ns, { cam1: urls.cam1, cam2: 'https://vdo.ninja/?view=b' });
  assert.deepEqual([...el2.querySelectorAll('iframe')].map((x) => x.dataset.cam), ['cam2']);
});

test('una cámara repetida en dos recuadros usa un solo iframe; no se recrean si nada cambió; al quitar los videos se cierran', () => {
  const s = mk(); s.split.layouts[2][1].cam = 'cam1';
  const urls = { cam1: 'https://vdo.ninja/?view=a' };
  const el = fresh(); renderSplitView(el, s, urls);
  assert.equal(el.querySelectorAll('iframe').length, 1);
  const first = el.querySelector('iframe');
  renderSplitView(el, s, urls);
  assert.equal(el.querySelector('iframe'), first);
  renderSplitView(el, s, null);
  assert.equal(el.querySelectorAll('iframe').length, 0);
});
