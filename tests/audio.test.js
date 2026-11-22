import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createSourceElement, neededIds, volumeFor, applyVolumes, markAudioOnly, visibleIds, clearFadeStyles } from '../public/shared/sources.js';

const base = { program: 'cam1', preview: 'cam2', lastTake: null, audioMaster: null, vtr: { playing: false } };

test('volumeFor: solo la cámara master suena; sin master todo en 0', () => {
  assert.equal(volumeFor({ ...base, audioMaster: 'cam2' }, 'cam2'), 1);
  assert.equal(volumeFor({ ...base, audioMaster: 'cam2' }, 'cam1'), 0);
  assert.equal(volumeFor(base, 'cam1'), 0);
});

test('volumeFor: el VTR suena solo si está al aire y reproduciendo', () => {
  assert.equal(volumeFor({ ...base, program: 'vtr', vtr: { playing: true } }, 'vtr'), 1);
  assert.equal(volumeFor({ ...base, program: 'vtr', vtr: { playing: false } }, 'vtr'), 0);
  assert.equal(volumeFor({ ...base, program: 'cam1', vtr: { playing: true } }, 'vtr'), 0);
});

test('neededIds incluye al audio master aunque no esté al aire, sin duplicar', () => {
  assert.deepEqual(neededIds({ ...base, audioMaster: 'cam5' }, false), ['cam1', 'cam2', 'cam5']);
  assert.deepEqual(neededIds({ ...base, audioMaster: 'cam1' }, false), ['cam1', 'cam2']);
  assert.deepEqual(neededIds({ ...base, program: 'vtr', audioMaster: 'cam5' }, false), ['vtr', 'cam2', 'cam5']);
});

function mount(kinds) {
  const { document } = parseHTML('<div id="c"></div>');
  global.document = document;
  const c = document.getElementById('c');
  const calls = {};
  for (const [id, kind] of Object.entries(kinds)) {
    const el = createSourceElement({ id, kind }, { url: 'https://x/' });
    calls[id] = [];
    if (kind === 'vdo' || kind === 'twitch') el.contentWindow = { postMessage: (m, o) => calls[id].push([m, o]) };
    c.append(el);
  }
  return { c, calls };
}

test('applyVolumes manda {volume} a los iframes de VDO.Ninja y solo el master queda en 1', () => {
  const { c, calls } = mount({ cam1: 'vdo', cam2: 'vdo' });
  applyVolumes(c, (id) => volumeFor({ ...base, audioMaster: 'cam2' }, id));
  assert.deepEqual(calls.cam1, [[{ volume: 0 }, 'https://vdo.ninja']]);
  assert.deepEqual(calls.cam2, [[{ volume: 1 }, 'https://vdo.ninja']]);
});

test('applyVolumes no toca los iframes de Twitch y silencia/activa el <video> del VTR', () => {
  const { c, calls } = mount({ cam7: 'twitch', vtr: 'vtr' });
  applyVolumes(c, (id) => (id === 'vtr' ? 1 : 0));
  assert.deepEqual(calls.cam7, []);
  assert.equal(c.querySelector('[data-source-id="vtr"]').muted, false);
  applyVolumes(c, () => 0);
  assert.equal(c.querySelector('[data-source-id="vtr"]').muted, true);
});

test('markAudioOnly marca como solo-audio lo que no está visible', () => {
  const { c } = mount({ cam1: 'vdo', cam5: 'vdo' });
  markAudioOnly(c, ['cam1']);
  assert.equal(c.querySelector('[data-source-id="cam1"]').classList.contains('audio-only'), false);
  assert.equal(c.querySelector('[data-source-id="cam5"]').classList.contains('audio-only'), true);
});

test('neededIds precarga la fuente en preview (para que el CUT/FADE no muestre negro)', () => {
  assert.deepEqual(neededIds({ ...base, preview: 'cam3' }, false), ['cam1', 'cam3']);
  assert.deepEqual(neededIds({ ...base, program: 'cam2', preview: 'cam1', lastTake: { from: 'cam1', to: 'cam2', mode: 'fade', seq: 1 } }, true), ['cam2', 'cam1']);
});

test('visibleIds: solo la al aire; durante un fade también la saliente (no el preview ni el audio master)', () => {
  const st = { ...base, program: 'cam2', preview: 'cam1', audioMaster: 'cam5', lastTake: { from: 'cam1', to: 'cam2', mode: 'fade', seq: 1 } };
  assert.deepEqual(visibleIds(st, false), ['cam2']);
  assert.deepEqual(visibleIds(st, true), ['cam2', 'cam1']);
});

test('clearFadeStyles limpia opacity y zIndex en línea de todos los hijos (un fade de vuelta no queda tapado)', () => {
  const { c } = mount({ cam1: 'vdo', cam2: 'vdo' });
  for (const el of c.children) { el.style.opacity = '1'; el.style.zIndex = '2'; }
  clearFadeStyles(c);
  for (const el of c.children) { assert.equal(el.style.opacity, ''); assert.equal(el.style.zIndex, ''); }
});
