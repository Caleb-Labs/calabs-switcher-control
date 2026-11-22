import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.js';
import { uploadRoute } from '../server/upload.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'up-'));
const outside = path.join(path.dirname(dir), 'escapado.png');
const config = { teams: Array.from({ length: 8 }, (_, i) => ({ name: `E${i}`, players: ['a', 'b'], source: { kind: 'vdo', room: `r${i}` } })) };
const srv = await startServer({
  port: 0, config, publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  extraRoutes: [uploadRoute({ dir, maxBytes: 1000 })],
});
after(async () => { await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(outside, { force: true }); });

const post = (name, body, headers = {}) =>
  fetch(`http://127.0.0.1:${srv.port}/api/upload?name=${encodeURIComponent(name)}`, { method: 'POST', body, headers });

test('sube un archivo permitido, lo guarda en la carpeta y actualiza la lista del VTR al instante', async () => {
  const res = await post('fondo 2.png', Buffer.from('PNGDATA'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, name: 'fondo 2.png' });
  assert.equal(fs.readFileSync(path.join(dir, 'fondo 2.png'), 'utf8'), 'PNGDATA');
  assert.ok(srv.getState().vtr.files.includes('fondo 2.png'));
});

test('subir otra vez con el mismo nombre reemplaza el archivo', async () => {
  await post('a.png', Buffer.from('uno'));
  await post('a.png', Buffer.from('dos'));
  assert.equal(fs.readFileSync(path.join(dir, 'a.png'), 'utf8'), 'dos');
});

test('rechaza extensiones no permitidas y nombres vacíos o sin extensión', async () => {
  for (const name of ['virus.exe', 'notas.txt', 'sinextension', '', '.png']) {
    assert.equal((await post(name, Buffer.from('x'))).status, 400, name);
  }
  assert.equal(fs.existsSync(path.join(dir, 'virus.exe')), false);
});

test('un nombre con ../ o rutas se reduce al nombre de archivo y nunca sale de la carpeta', async () => {
  const res = await post('../../escapado.png', Buffer.from('x'));
  assert.equal(res.status, 200);
  assert.equal(fs.existsSync(outside), false);
  assert.equal(fs.existsSync(path.join(dir, 'escapado.png')), true);
  assert.equal((await (await post('C:\\temp\\raro\\foto.jpg', Buffer.from('x'))).json()).name, 'foto.jpg');
});

test('limita el tamaño: 413 si pasa de maxBytes y no deja archivo a medias', async () => {
  const res = await post('grande.png', Buffer.alloc(5000, 1));
  assert.equal(res.status, 413);
  assert.equal(fs.existsSync(path.join(dir, 'grande.png')), false);
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.part')), []);
});

test('solo POST y sin Origin ajeno', async () => {
  assert.equal((await fetch(`http://127.0.0.1:${srv.port}/api/upload?name=x.png`)).status, 405);
  assert.equal((await post('x.png', Buffer.from('x'), { origin: 'https://evil.example' })).status, 403);
  assert.equal(fs.existsSync(path.join(dir, 'x.png')), false);
});
