import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createSourceElement, neededIds, volumeFor, applyVolumes, markAudioOnly } from '../public/shared/sources.js';

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
  assert.deepEqual(neededIds({ ...base, audioMaster: 'cam5' }, false), ['cam1', 'cam5']);
  assert.deepEqual(neededIds({ ...base, audioMaster: 'cam1' }, false), ['cam1']);
  assert.deepEqual(neededIds({ ...base, program: 'vtr', audioMaster: 'cam5' }, false), ['vtr', 'cam5']);
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
