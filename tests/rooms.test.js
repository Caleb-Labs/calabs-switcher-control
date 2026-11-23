import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { isValidRoom, cleanRoomInput } from '../public/shared/room.js';
import { randomRoom } from '../public/control/messages.js';
import { parseConfig } from '../server/config.js';
import { createState, reduce } from '../server/state.js';
import { startServer } from '../server/index.js';
import { sourcesRoute, linksRoute } from '../server/api.js';

// VDO.Ninja cambia todo lo que no sea letra, número o "_" por "_" en el nombre de la sala (replace(/[\W]+/g, "_")):
// con un guion, la sala del emisor deja de coincidir con la que mira el panel.
const team = (i, room) => ({ name: `Equipo ${i}`, players: ['a', 'b'], source: { kind: 'vdo', ...(room === undefined ? {} : { room }) } });
const teams = (f) => Array.from({ length: 8 }, (_, i) => team(i + 1, f(i + 1)));
const apply = (s, ...a) => a.reduce(reduce, s);

test('isValidRoom: letras, números y _ (3 a 50); nunca guion, espacios ni acentos', () => {
  for (const ok of ['sala_2', 'abc', 'Equipo1', 'a'.repeat(50)]) assert.equal(isValidRoom(ok), true, ok);
  for (const bad of ['sala-2', 'ab', 'con espacio', 'ñandú', 'a'.repeat(51), '', 5, null]) assert.equal(isValidRoom(bad), false, String(bad));
});

test('cleanRoomInput cambia lo no permitido por _ igual que VDO.Ninja', () => {
  assert.equal(cleanRoomInput('  sot-torneo eq1 '), 'sot_torneo_eq1');
  assert.equal(cleanRoomInput('a--b'), 'a_b');
  assert.equal(cleanRoomInput('ok_1'), 'ok_1');
  assert.equal(cleanRoomInput('x'.repeat(80)).length, 50);
  assert.equal(cleanRoomInput(null), '');
});

test('randomRoom ya no lleva guion ni prefijo: 10 letras y números', () => {
  const rooms = new Set(Array.from({ length: 50 }, () => randomRoom()));
  assert.equal(rooms.size, 50);
  for (const r of rooms) { assert.match(r, /^[a-z0-9]{10}$/); assert.equal(isValidRoom(r), true); }
});

test('parseConfig: la sala puede ir en blanco; si tiene guiones se pasan a _; una sala demasiado corta es error', () => {
  assert.equal(parseConfig({ teams: teams(() => '') }).teams[0].source.room, '');
  assert.equal(parseConfig({ teams: teams(() => undefined) }).teams[0].source.room, '');
  assert.equal(parseConfig({ teams: teams((i) => `sot-torneo-eq${i}`) }).teams[2].source.room, 'sot_torneo_eq3');
  assert.throws(() => parseConfig({ teams: teams(() => 'ab') }), /sala/i);
  assert.equal(parseConfig({ teams: teams(() => ''), aerial: { name: 'A', source: { kind: 'vdo', room: '' } } }).aerial.source.room, '');
});

const blank = () => ({ teams: teams(() => ''), aerial: { name: 'Aérea', source: { kind: 'vdo', room: '' } } });

test('con las salas en blanco el estado arranca y ninguna cámara tiene sala', () => {
  const s = createState(blank());
  assert.equal(s.conn.rooms.cam1, '');
  assert.equal(s.conn.rooms.cam9, '');
});

test('datos viejos: las salas guardadas con guion se descartan (nunca funcionaron); las válidas se conservan', () => {
  const s = createState({ ...blank(), saved: { conn: { rooms: { cam1: 'sot-torneo-eq1', cam2: 'mi_sala2', cam3: 'otra-sala' } } } });
  assert.equal(s.conn.rooms.cam1, '');
  assert.equal(s.conn.rooms.cam2, 'mi_sala2');
  assert.equal(s.conn.rooms.cam3, '');
});

test('CONN_ROOM y CONN_ROOMS rechazan salas con guion y aceptan las válidas', () => {
  const s0 = createState(blank());
  assert.equal(apply(s0, { type: 'CONN_ROOM', id: 'cam1', room: 'sala-1' }), s0);
  assert.equal(apply(s0, { type: 'CONN_ROOMS', rooms: { cam1: 'sala-1' } }), s0);
  assert.equal(apply(s0, { type: 'CONN_ROOM', id: 'cam1', room: 'sala_1' }).conn.rooms.cam1, 'sala_1');
  const m = apply(s0, { type: 'CONN_ROOMS', rooms: { cam1: 'sala_1', cam2: 'sala-2' } });
  assert.equal(m.conn.rooms.cam1, 'sala_1');
  assert.equal(m.conn.rooms.cam2, '');
});

const cfg = { teams: teams((i) => (i === 1 ? '' : `sala_${i}`)), aerial: { name: 'Aérea', source: { kind: 'vdo', room: '' } } };
const srv = await startServer({ port: 0, config: cfg, publicDir: fileURLToPath(new URL('../public', import.meta.url)), extraRoutes: [sourcesRoute(cfg), linksRoute(cfg)] });
after(() => srv.close());
const get = async (p) => (await fetch(`http://127.0.0.1:${srv.port}${p}`)).json();

test('/api/sources: una cámara sin sala no tiene url; las demás sí', async () => {
  const list = await get('/api/sources?for=control');
  assert.equal(list[0].url, null);
  assert.match(list[1].url, /view=sala_2/);
  assert.equal(list[8].url, null); // la aérea también
});

test('/api/links: una cámara sin sala no genera links', async () => {
  const links = await get('/api/links');
  const c1 = links.find((l) => l.id === 'cam1');
  assert.equal(c1.room, '');
  assert.equal(c1.browser, null);
  assert.equal(c1.vcam, null);
  assert.equal(c1.view, null);
  assert.match(links.find((l) => l.id === 'cam2').browser, /push=sala_2/);
});
