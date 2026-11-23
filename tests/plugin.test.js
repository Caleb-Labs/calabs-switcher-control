import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { COMMANDS } from '../server/commands.js';
import { ETIQUETAS, GRUPOS } from '../macropad/plugin/etiquetas.js';
import { connectWS } from '../macropad/plugin/fuente/com.multicam.control.sdPlugin/bin/wsclient.js';
import { parseArgs, isValidCommand } from '../macropad/plugin/fuente/com.multicam.control.sdPlugin/bin/plugin.js';
import { buildPlugin, comandoHtml, PLUGIN_DIR } from '../macropad/plugin/build.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const PLUGIN_JS = path.join(PLUGIN_DIR, 'bin', 'plugin.js');
const cleanup = [];
after(() => cleanup.forEach((f) => f()));
const once = (emitter, ev) => new Promise((ok) => emitter.once(ev, ok));
const listen = (server) => new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server.address().port)));

// ---------- cliente WebSocket mínimo (sin dependencias) ----------
test('wsclient: manda y recibe texto, incluidos mensajes grandes en varios tamaños de cabecera', async () => {
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' }); await once(wss, 'listening');
  cleanup.push(() => wss.close());
  wss.on('connection', (s) => s.on('message', (m) => s.send(m.toString())));
  const got = [];
  const c = connectWS(`ws://127.0.0.1:${wss.address().port}`, { onMessage: (t) => got.push(t) });
  await c.ready;
  const msgs = ['hola', 'x'.repeat(125), 'y'.repeat(126), 'z'.repeat(70000), 'ñandú ✓ 🎛️'];
  for (const m of msgs) c.send(m);
  await new Promise((ok) => { const t = setInterval(() => { if (got.length === msgs.length) { clearInterval(t); ok(); } }, 20); });
  assert.deepEqual(got, msgs);
  c.close();
});

test('wsclient: responde a los ping del servidor y avisa cuando se cierra', async () => {
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' }); await once(wss, 'listening');
  cleanup.push(() => wss.close());
  let pong = false;
  wss.on('connection', (s) => { s.on('pong', () => { pong = true; s.close(); }); s.ping(); });
  let closed = false;
  const c = connectWS(`ws://127.0.0.1:${wss.address().port}`, { onClose: () => { closed = true; } });
  await c.ready;
  await new Promise((ok) => { const t = setInterval(() => { if (closed) { clearInterval(t); ok(); } }, 20); });
  assert.equal(pong, true);
});

// ---------- plugin ----------
test('parseArgs lee los argumentos con que el software lanza el plugin', () => {
  const a = parseArgs(['-port', '28196', '-pluginUUID', 'ABC', '-registerEvent', 'registerPlugin', '-info', '{"x":1}']);
  assert.deepEqual(a, { port: 28196, pluginUUID: 'ABC', registerEvent: 'registerPlugin', info: '{"x":1}' });
  assert.equal(parseArgs([]).port, null);
});

test('isValidCommand solo acepta comandos reales del macropad', () => {
  assert.equal(isValidCommand('cut'), true);
  assert.equal(isValidCommand('emergency-toggle'), true);
  for (const bad of ['cut & calc', '../x', '', 'Cut', 'a b', null, undefined, 5]) assert.equal(isValidCommand(bad), false, String(bad));
});

// Software de mentira: abre un WebSocket como el Stream Deck, lanza el plugin y le manda pulsaciones.
async function fakeHost(multicamPort) {
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' }); await once(wss, 'listening');
  const received = [];
  let sock;
  wss.on('connection', (s) => { sock = s; s.on('message', (m) => received.push(JSON.parse(m.toString()))); });
  const child = spawn(process.execPath, [PLUGIN_JS, '-port', String(wss.address().port), '-pluginUUID', 'UUID-1', '-registerEvent', 'registerPlugin', '-info', '{}'], { stdio: 'ignore' });
  cleanup.push(() => { child.kill(); wss.close(); });
  await new Promise((ok) => { const t = setInterval(() => { if (received.some((r) => r.event === 'registerPlugin')) { clearInterval(t); ok(); } }, 20); });
  const press = (settings, context = 'ctx1') => sock.send(JSON.stringify({ event: 'keyDown', action: 'com.multicam.control.comando', context, device: 'D', payload: { settings: { port: multicamPort, ...settings }, coordinates: { column: 0, row: 0 }, state: 0, isInMultiAction: false } }));
  const waitFor = (fn) => new Promise((ok, no) => { const t0 = Date.now(); const t = setInterval(() => { const r = received.find(fn); if (r) { clearInterval(t); ok(r); } else if (Date.now() - t0 > 4000) { clearInterval(t); no(new Error('no llegó')); } }, 20); });
  return { received, press, waitFor };
}

test('el plugin se registra y, al pulsar la tecla, manda el comando a Multicam por POST', async () => {
  const posts = [];
  const srv = http.createServer((req, res) => { posts.push(`${req.method} ${req.url}`); res.writeHead(200).end('{}'); });
  const port = await listen(srv); cleanup.push(() => srv.close());
  const host = await fakeHost(port);
  assert.deepEqual(host.received[0], { event: 'registerPlugin', uuid: 'UUID-1' });
  host.press({ command: 'cut' });
  host.press({ command: 'emergency-toggle' }, 'ctx2');
  await new Promise((ok) => { const t = setInterval(() => { if (posts.length >= 2) { clearInterval(t); ok(); } }, 20); });
  assert.deepEqual(posts.sort(), ['POST /api/do/cut', 'POST /api/do/emergency-toggle']);
  assert.equal(host.received.filter((r) => r.event === 'showAlert').length, 0);
});

test('si el comando no existe o Multicam no responde, la tecla muestra el aviso (✗)', async () => {
  const host = await fakeHost(1); // puerto donde no hay nada
  host.press({ command: 'inventado' }, 'a');
  const bad = await host.waitFor((r) => r.event === 'showAlert' && r.context === 'a');
  assert.equal(bad.event, 'showAlert');
  host.press({ command: 'cut' }, 'b');
  assert.ok(await host.waitFor((r) => r.event === 'showAlert' && r.context === 'b'));
});

test('si Multicam contesta con error, también avisa', async () => {
  const srv = http.createServer((req, res) => res.writeHead(403).end('no'));
  const port = await listen(srv); cleanup.push(() => srv.close());
  const host = await fakeHost(port);
  host.press({ command: 'cut' }, 'c');
  assert.ok(await host.waitFor((r) => r.event === 'showAlert' && r.context === 'c'));
});

// ---------- etiquetas, pantalla de ajustes y paquete ----------
test('cada comando del macropad tiene su etiqueta en español y su grupo (y no sobra ninguna)', () => {
  assert.deepEqual(Object.keys(ETIQUETAS).sort(), [...COMMANDS].sort());
  const agrupados = GRUPOS.flatMap((g) => g.comandos);
  assert.deepEqual([...agrupados].sort(), [...COMMANDS].sort());
  assert.equal(new Set(agrupados).size, agrupados.length, 'un comando en dos grupos');
});

test('la pantalla de ajustes lista todos los comandos y no depende de internet', () => {
  const html = comandoHtml();
  for (const c of COMMANDS) assert.ok(html.includes(`value="${c}"`), c);
  assert.ok(!/https?:\/\/(?!127\.0\.0\.1)/.test(html.replace(/xmlns="[^"]*"/g, '')), 'sin recursos externos');
  assert.match(html, /connectElgatoStreamDeckSocket/);
});

test('la pantalla de ajustes del repo está al día con las etiquetas', () => {
  assert.equal(fs.readFileSync(path.join(PLUGIN_DIR, 'ui', 'comando.html'), 'utf8'), comandoHtml());
});

test('el manifiesto es coherente y todos los archivos que nombra existen', () => {
  const m = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, 'manifest.json'), 'utf8'));
  assert.equal(m.UUID, 'com.multicam.control');
  assert.equal(m.SDKVersion, 2);
  assert.equal(m.Actions[0].UUID, 'com.multicam.control.comando');
  assert.ok(m.Actions[0].UUID.startsWith(m.UUID + '.'));
  assert.deepEqual(m.Actions[0].Controllers, ['Keypad']);
  assert.ok(fs.existsSync(path.join(PLUGIN_DIR, m.CodePath)));
  assert.ok(fs.existsSync(path.join(PLUGIN_DIR, m.Actions[0].PropertyInspectorPath)));
  for (const base of [m.Icon, m.CategoryIcon, m.Actions[0].Icon, m.Actions[0].States[0].Image]) {
    assert.ok(fs.existsSync(path.join(PLUGIN_DIR, `${base}.png`)), base);
    assert.ok(fs.existsSync(path.join(PLUGIN_DIR, `${base}@2x.png`)), `${base}@2x`);
  }
});

test('buildPlugin arma un zip con la carpeta .sdPlugin adentro, listo para importar', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'plg-')); cleanup.push(() => fs.rmSync(out, { recursive: true, force: true }));
  const file = buildPlugin(out);
  assert.equal(path.basename(file), 'com.multicam.control.sdPlugin');
  const buf = fs.readFileSync(file);
  assert.equal(buf.subarray(0, 2).toString(), 'PK');
  const names = buf.toString('latin1');
  for (const n of ['com.multicam.control.sdPlugin/manifest.json', 'com.multicam.control.sdPlugin/bin/plugin.js', 'com.multicam.control.sdPlugin/bin/wsclient.js', 'com.multicam.control.sdPlugin/ui/comando.html']) assert.ok(names.includes(n), n);
});
