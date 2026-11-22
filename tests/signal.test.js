import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusFromMessage } from '../public/shared/signal.js';

const sources = [
  { id: 'cam1', url: 'https://vdo.ninja/?view=sala1&videobitrate=3000&cleanoutput=' },
  { id: 'cam2', url: 'https://vdo.ninja/?view=sala%202&videobitrate=3000' },
  { id: 'vtr', url: null },
];
const ev = (data, origin = 'https://vdo.ninja') => ({ origin, data });

test('view-connection false -> nosignal; true -> live', () => {
  assert.deepEqual(statusFromMessage(ev({ action: 'view-connection', value: false, streamID: 'sala1' }), sources), { id: 'cam1', status: 'nosignal' });
  assert.deepEqual(statusFromMessage(ev({ action: 'view-connection', value: true, streamID: 'sala1' }), sources), { id: 'cam1', status: 'live' });
});

test('end-view-connection -> nosignal, y el streamID con espacios se resuelve', () => {
  assert.deepEqual(statusFromMessage(ev({ action: 'end-view-connection', streamID: 'sala 2' }), sources), { id: 'cam2', status: 'nosignal' });
});

test('origen ajeno, streamID desconocido, acción desconocida o basura -> null', () => {
  assert.equal(statusFromMessage(ev({ action: 'view-connection', value: false, streamID: 'sala1' }, 'https://evil.example'), sources), null);
  assert.equal(statusFromMessage(ev({ action: 'view-connection', value: false, streamID: 'otra' }), sources), null);
  assert.equal(statusFromMessage(ev({ action: 'loaded', streamID: 'sala1' }), sources), null);
  for (const d of [null, undefined, 'texto', 42, {}]) assert.equal(statusFromMessage(ev(d), sources), null);
});
