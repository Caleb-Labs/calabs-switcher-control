import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerMessage, randomRoom } from '../public/control/messages.js';

const link = { id: 'cam2', label: 'Los Piratas', kind: 'vdo', room: 'sala2', password: 'Clave123', browser: 'https://vdo.ninja/?push=sala2&screenshare=&quality=0', vcam: 'https://vdo.ninja/?push=sala2&webcam=&quality=0' };

test('el mensaje para el jugador trae ambos links, el nombre y los pasos de las dos formas', () => {
  const m = playerMessage(link);
  assert.match(m, /Los Piratas/);
  assert.ok(m.includes(link.browser));
  assert.ok(m.includes(link.vcam));
  assert.match(m, /Opción A/);
  assert.match(m, /Opción B/);
  assert.match(m, /OBS Virtual Camera/);
  assert.match(m, /audio/i);
});

test('el mensaje menciona la contraseña solo si hay una', () => {
  assert.match(playerMessage(link), /Clave123/);
  assert.doesNotMatch(playerMessage({ ...link, password: '' }), /Contraseña/);
});

test('randomRoom genera salas válidas y distintas, difíciles de adivinar', () => {
  const rooms = new Set(Array.from({ length: 50 }, () => randomRoom('sot')));
  assert.equal(rooms.size, 50);
  for (const r of rooms) assert.match(r, /^sot-[a-z0-9]{8}$/);
});
