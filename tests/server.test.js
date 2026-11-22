import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import WebSocket from 'ws';
import { startServer } from '../server/index.js';

const team = (i) => ({ name: `Equipo ${i}`, players: ['a', 'b'], source: { kind: 'vdo', room: `r${i}` } });
const config = { teams: Array.from({ length: 8 }, (_, i) => team(i + 1)) };

const servers = [];
async function boot() {
  const srv = await startServer({ port: 0, config, publicDir: fileURLToPath(new URL('../public', import.meta.url)) });
  servers.push(srv);
  return srv;
}
after(() => Promise.all(servers.map((s) => s.close())));

// Cliente con cola de mensajes para esperar el siguiente estado.
function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const queue = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    const w = waiters.shift();
    if (w) w(msg); else queue.push(msg);
  });
  return {
    ws,
    open: () => new Promise((res) => ws.once('open', res)),
    next: () => new Promise((res) => { const m = queue.shift(); m ? res(m) : waiters.push(res); }),
    send: (obj) => ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)),
    close: () => ws.close(),
  };
}

test('un cliente nuevo recibe el estado inicial', async () => {
  const { port } = await boot();
  const c = client(port);
  const msg = await c.next();
  assert.equal(msg.type, 'state');
  assert.equal(msg.state.program, 'cam1');
  c.close();
});

test('una acción de un cliente llega a otro cliente', async () => {
  const { port } = await boot();
  const a = client(port), b = client(port);
  await a.next(); await b.next();
  a.send({ type: 'action', action: { type: 'SET_PREVIEW', id: 'cam3' } });
  const msg = await b.next();
  assert.equal(msg.state.preview, 'cam3');
  a.close(); b.close();
});

test('acciones malformadas se ignoran sin tirar el servidor', async () => {
  const { port } = await boot();
  const a = client(port);
  await a.next();
  a.send('{esto no es json');
  a.send({ type: 'action', action: { type: 'NO_EXISTE' } });
  a.send({ type: 'otra-cosa' });
  a.send({ type: 'action', action: { type: 'SET_PREVIEW', id: 'cam4' } });
  const msg = await a.next();
  assert.equal(msg.state.preview, 'cam4');
  a.close();
});

test('un cliente que llega tarde recibe el estado actual (recarga de página)', async () => {
  const { port } = await boot();
  const a = client(port);
  await a.next();
  a.send({ type: 'action', action: { type: 'SET_PREVIEW', id: 'cam5' } });
  await a.next();
  a.send({ type: 'action', action: { type: 'TAKE', mode: 'cut' } });
  await a.next();
  const late = client(port);
  const msg = await late.next();
  assert.equal(msg.state.program, 'cam5');
  assert.equal(msg.state.preview, 'cam1');
  a.close(); late.close();
});

test('sirve archivos estáticos y no permite salir de public/', async () => {
  const { port } = await boot();
  const ok = await fetch(`http://127.0.0.1:${port}/shared/client.js`);
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('content-type'), /javascript/);
  const bad = await fetch(`http://127.0.0.1:${port}/..%2fpackage.json`);
  assert.equal(bad.status, 404);
});

test('un request HTTP malformado responde 400 y el servidor sigue vivo', async () => {
  const { port } = await boot();
  const reply = await new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1', () => sock.write('GET http://[ HTTP/1.1\r\nHost: x\r\n\r\n'));
    let buf = '';
    sock.on('data', (d) => { buf += d; if (buf.includes('\r\n')) { sock.destroy(); resolve(buf); } });
    sock.on('error', reject);
    sock.on('close', () => resolve(buf));
  });
  assert.match(reply, /^HTTP\/1\.1 400/);
  const ok = await fetch(`http://127.0.0.1:${port}/shared/client.js`);
  assert.equal(ok.status, 200);
});

test('por defecto escucha solo en 127.0.0.1', async () => {
  const srv = await boot();
  assert.equal(srv.host, '127.0.0.1');
});

test('un cliente no puede mandar acciones internas (SCOREBOARD_*, VTR_FILES) ni GC inválidos', async () => {
  const { port } = await boot();
  const a = client(port);
  await a.next();
  a.send({ type: 'action', action: { type: 'SCOREBOARD_UPDATE', teams: [{ name: 'X', points: 99, position: 1 }] } });
  a.send({ type: 'action', action: { type: 'VTR_FILES', files: ['malo.mp4'] } });
  a.send({ type: 'action', action: { type: 'GC_ARM', gcId: 'g', template: 'nope', data: {} } });
  a.send({ type: 'action', action: { type: 'GC_LIVE', gcId: 'toString' } });
  a.send({ type: 'action', action: { type: 'SET_PREVIEW', id: 'cam6' } });
  const msg = await a.next();
  assert.equal(msg.state.preview, 'cam6');
  assert.deepEqual(msg.state.scoreboard.teams, []);
  assert.deepEqual(msg.state.vtr.files, []);
  assert.deepEqual(msg.state.gc, {});
  a.close();
});

test('los archivos estáticos se sirven sin caché para que el panel cargue siempre la versión actual', async () => {
  const srv = await boot();
  const res = await fetch(`http://127.0.0.1:${srv.port}/control/control.js`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});
