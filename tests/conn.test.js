import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createState, reduce, persistable } from '../server/state.js';
import { pushLink, viewLink } from '../server/links.js';
import { startServer } from '../server/index.js';
import { sourcesRoute, linksRoute } from '../server/api.js';

const team = (i) => ({ name: `Equipo ${i}`, players: ['a', 'b'], source: i === 7 ? { kind: 'twitch', channel: 'canal7' } : { kind: 'vdo', room: `sala${i}` } });
const config = { teams: Array.from({ length: 8 }, (_, i) => team(i + 1)), aerial: { name: 'Aérea', source: { kind: 'vdo', room: 'aerea' } } };
const S = (c = config) => createState(c);
const apply = (s, ...a) => a.reduce(reduce, s);

// ---------- links ----------
const vdo = (room) => ({ name: 'E', players: ['a', 'b'], source: { kind: 'vdo', room } });

test('pushLink navegador: compartir pantalla, calidad 1080p/720p, fps y contraseña', () => {
  const u = new URL(pushLink(vdo('sala1'), { quality: '1080p', fps: 30, password: 'Clave123' }));
  assert.equal(u.searchParams.get('push'), 'sala1');
  assert.ok(u.searchParams.has('screenshare'));
  assert.equal(u.searchParams.get('quality'), '0');
  assert.equal(u.searchParams.get('fps'), '30');
  assert.equal(u.searchParams.get('password'), 'Clave123');
  assert.equal(new URL(pushLink(vdo('s'), { quality: '720p' })).searchParams.get('quality'), '1');
  assert.ok(!new URL(pushLink(vdo('s'))).searchParams.has('password'));
});

test('pushLink con OBS (cámara virtual): usa la cámara en vez de compartir pantalla', () => {
  const u = new URL(pushLink(vdo('sala1'), { mode: 'vcam', quality: '1080p', password: 'x1' }));
  assert.ok(u.searchParams.has('webcam'));
  assert.ok(!u.searchParams.has('screenshare'));
  assert.equal(u.searchParams.get('password'), 'x1');
});

test('viewLink lleva la misma contraseña que el link de envío', () => {
  assert.equal(new URL(viewLink(vdo('sala1'), { password: 'Clave123' })).searchParams.get('password'), 'Clave123');
  assert.ok(!new URL(viewLink(vdo('sala1'))).searchParams.has('password'));
});

// ---------- estado ----------
test('conn: salas y ajustes iniciales salen de la config (1080p a 30 fps, sin contraseña)', () => {
  const c = S().conn;
  assert.equal(c.password, '');
  assert.equal(c.quality, '1080p');
  assert.equal(c.fps, 30);
  assert.equal(c.rooms.cam1, 'sala1');
  assert.equal(c.rooms.cam9, 'aerea');
  assert.equal(c.rooms.cam7, undefined); // twitch: no tiene sala
  assert.equal(S().connRev, 0);
});

test('CONN_SET valida contraseña (alfanumérica, vacía permitida), calidad y fps; sube connRev', () => {
  let s = apply(S(), { type: 'CONN_SET', password: 'Torneo2026', quality: '720p', fps: 60 });
  assert.deepEqual({ p: s.conn.password, q: s.conn.quality, f: s.conn.fps, rev: s.connRev }, { p: 'Torneo2026', q: '720p', f: 60, rev: 1 });
  s = apply(s, { type: 'CONN_SET', password: '' });
  assert.equal(s.conn.password, '');
  const s0 = S();
  for (const bad of [{ password: 'con espacio' }, { password: 'x'.repeat(60) }, { quality: '4k' }, { fps: 24 }, { password: 5 }, {}]) {
    assert.equal(apply(s0, { type: 'CONN_SET', ...bad }), s0);
  }
});

test('CONN_ROOM cambia la sala de una cámara (solo ids válidos y nombres seguros)', () => {
  const s = apply(S(), { type: 'CONN_ROOM', id: 'cam2', room: 'mi-sala_2' });
  assert.equal(s.conn.rooms.cam2, 'mi-sala_2');
  assert.equal(s.connRev, 1);
  const s0 = S();
  for (const bad of [{ id: 'cam2', room: 'ab' }, { id: 'cam2', room: 'con espacio' }, { id: 'cam2', room: 'ñandú' }, { id: 'cam7', room: 'sala-7' }, { id: 'nope', room: 'sala-x' }, { id: 'toString', room: 'sala-x' }, { id: 'cam2', room: 5 }]) {
    assert.equal(apply(s0, { type: 'CONN_ROOM', ...bad }), s0);
  }
});

test('CONN_ROOMS aplica varias salas a la vez (para generar salas aleatorias)', () => {
  const s = apply(S(), { type: 'CONN_ROOMS', rooms: { cam1: 'sot-aaaa1111', cam2: 'sot-bbbb2222', cam7: 'no-twitch', nope: 'xxxxxx' } });
  assert.equal(s.conn.rooms.cam1, 'sot-aaaa1111');
  assert.equal(s.conn.rooms.cam2, 'sot-bbbb2222');
  assert.equal(s.conn.rooms.cam7, undefined);
  assert.equal(s.connRev, 1);
  const s0 = S();
  assert.equal(apply(s0, { type: 'CONN_ROOMS', rooms: 'x' }), s0);
});

test('la conexión se guarda en disco', () => {
  const s = apply(S(), { type: 'CONN_SET', password: 'Clave1', quality: '720p' }, { type: 'CONN_ROOM', id: 'cam3', room: 'sala-tres' });
  const r = S({ ...config, saved: JSON.parse(JSON.stringify(persistable(s))) });
  assert.equal(r.conn.password, 'Clave1');
  assert.equal(r.conn.quality, '720p');
  assert.equal(r.conn.rooms.cam3, 'sala-tres');
  const bad = S({ ...config, saved: { conn: { password: 'con espacio', quality: 'x', fps: 1, rooms: { cam1: 'ñ', cam7: 'x1234', nope: 'abcdef' } } } });
  assert.equal(bad.conn.password, '');
  assert.equal(bad.conn.quality, '1080p');
  assert.equal(bad.conn.rooms.cam1, 'sala1');
});

// ---------- API ----------
const srv = await startServer({
  port: 0, config, publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  extraRoutes: [sourcesRoute(config), linksRoute(config)],
});
after(() => srv.close());
const get = async (p) => (await fetch(`http://127.0.0.1:${srv.port}${p}`)).json();

test('/api/sources usa las salas y la contraseña actuales del estado', async () => {
  srv.dispatch({ type: 'CONN_SET', password: 'Clave123' });
  srv.dispatch({ type: 'CONN_ROOM', id: 'cam2', room: 'sala-nueva' });
  const list = await get('/api/sources?for=control');
  const u = new URL(list[1].url);
  assert.equal(u.searchParams.get('view'), 'sala-nueva');
  assert.equal(u.searchParams.get('password'), 'Clave123');
  assert.match(list[6].url, /^https:\/\/player\.twitch\.tv\//);
});

test('/api/links lista por cámara activa: sala, link para el navegador, link para OBS y link de vista', async () => {
  srv.dispatch({ type: 'SET_CAM_COUNT', n: 3 });
  const links = await get('/api/links');
  assert.deepEqual(links.map((l) => l.id), ['cam1', 'cam2', 'cam3', 'cam9']);
  const c2 = links.find((l) => l.id === 'cam2');
  assert.equal(c2.room, 'sala-nueva');
  const b = new URL(c2.browser);
  assert.equal(b.searchParams.get('push'), 'sala-nueva');
  assert.ok(b.searchParams.has('screenshare'));
  assert.equal(b.searchParams.get('quality'), '0');
  assert.equal(b.searchParams.get('password'), 'Clave123');
  assert.ok(new URL(c2.vcam).searchParams.has('webcam'));
  assert.equal(new URL(c2.view).searchParams.get('view'), 'sala-nueva');
  assert.equal(c2.password, 'Clave123');
});
