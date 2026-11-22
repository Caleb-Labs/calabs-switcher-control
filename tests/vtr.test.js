import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { startServer } from '../server/index.js';
import { listMedia, vtrRoute, startVtrWatcher } from '../server/vtr.js';
import { vtrPlan } from '../public/shared/vtr.js';
import { renderGraphic } from '../public/graphics/templates.js';
import { syncGraphics } from '../public/graphics/layer.js';

const dirs = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vtr-')); dirs.push(d); return d; };
after(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

test('listMedia: carpeta vacía o inexistente -> []', () => {
  assert.deepEqual(listMedia(tmp()), []);
  assert.deepEqual(listMedia(path.join(tmp(), 'no-existe')), []);
});

test('listMedia ignora archivos no soportados y subcarpetas, ordena alfabético sin importar mayúsculas', () => {
  const d = tmp();
  for (const f of ['b.mp4', 'A.MP4', 'c.png', 'notas.txt', '.DS_Store', 'd.svg', 'e.webm', 'f.mov', 'g.jpg']) fs.writeFileSync(path.join(d, f), 'x');
  fs.mkdirSync(path.join(d, 'sub.mp4'));
  assert.deepEqual(listMedia(d), ['A.MP4', 'b.mp4', 'c.png', 'd.svg', 'e.webm', 'f.mov', 'g.jpg']);
});

test('listMedia tolera que un archivo se borre entre lecturas', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'a.mp4'), 'x'); fs.writeFileSync(path.join(d, 'b.mp4'), 'x');
  assert.deepEqual(listMedia(d), ['a.mp4', 'b.mp4']);
  fs.rmSync(path.join(d, 'a.mp4'));
  assert.deepEqual(listMedia(d), ['b.mp4']);
});

test('/vtr/<archivo>: sirve, soporta Range, y rechaza traversal, ocultos y tipos no soportados', async () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'a.mp4'), '0123456789');
  fs.writeFileSync(path.join(d, 'secreto.txt'), 'no');
  const config = { teams: Array.from({ length: 8 }, (_, i) => ({ name: `E${i}`, players: ['a', 'b'], source: { kind: 'vdo', room: `r${i}` } })) };
  const srv = await startServer({ port: 0, config, publicDir: fileURLToPath(new URL('../public', import.meta.url)), extraRoutes: [vtrRoute(d)] });
  try {
    const u = (p) => `http://127.0.0.1:${srv.port}${p}`;
    const ok = await fetch(u('/vtr/a.mp4'));
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'video/mp4');
    assert.equal(await ok.text(), '0123456789');
    const part = await fetch(u('/vtr/a.mp4'), { headers: { range: 'bytes=2-5' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(await part.text(), '2345');
    assert.equal((await fetch(u('/vtr/..%2fpackage.json'))).status, 404);
    assert.equal((await fetch(u('/vtr/secreto.txt'))).status, 404);
    assert.equal((await fetch(u('/vtr/no-existe.mp4'))).status, 404);
  } finally { await srv.close(); }
});

test('startVtrWatcher despacha VTR_FILES con "@tabla" primero, y solo cuando cambia', async () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'a.mp4'), 'x');
  const actions = [];
  const w = startVtrWatcher({ dir: d, dispatch: (a) => actions.push(a), autoStart: false });
  w.tick(); w.tick();
  assert.deepEqual(actions, [{ type: 'VTR_FILES', files: ['@tabla', 'a.mp4'] }]);
  fs.writeFileSync(path.join(d, 'b.png'), 'x');
  w.tick();
  assert.equal(actions.length, 2);
  assert.deepEqual(actions[1].files, ['@tabla', 'a.mp4', 'b.png']);
  w.stop();
});

test('vtrPlan: nada, imagen (poster), video (play) y tabla; la url se codifica', () => {
  assert.deepEqual(vtrPlan({ current: null, playing: false }), { kind: 'none', url: null, play: false });
  assert.deepEqual(vtrPlan({ current: 'logo.PNG', playing: true }), { kind: 'image', url: '/vtr/logo.PNG', play: false });
  assert.deepEqual(vtrPlan({ current: 'intro.mp4', playing: true }), { kind: 'video', url: '/vtr/intro.mp4', play: true });
  assert.equal(vtrPlan({ current: 'intro.mp4', playing: false }).play, false);
  assert.equal(vtrPlan({ current: 'mi intro ñ.mp4', playing: false }).url, '/vtr/mi%20intro%20%C3%B1.mp4');
  assert.deepEqual(vtrPlan({ current: '@tabla', playing: true }), { kind: 'standings', url: null, play: false });
});

test('la tabla a pantalla completa sale solo cuando el VTR está al aire con @tabla (y en preview si está en preview)', () => {
  const { document } = parseHTML('<div id="c"></div>');
  global.document = document;
  const c = document.getElementById('c');
  const st = { gc: {}, scoreboard: { teams: [{ name: 'A', points: 1, position: 1 }] }, emergency: false, program: 'cam1', preview: 'vtr', vtr: { current: '@tabla' } };
  syncGraphics(c, st, 'live');
  assert.equal(c.children.length, 0);
  syncGraphics(c, st, 'preview');
  assert.deepEqual([...c.children].map((e) => e.dataset.gcId), ['vtr-standings']);
  assert.ok(c.firstElementChild.classList.contains('full'));
  syncGraphics(c, { ...st, program: 'vtr', preview: 'cam2' }, 'live');
  assert.deepEqual([...c.children].map((e) => e.dataset.gcId), ['vtr-standings']);
  assert.ok(renderGraphic('standings', { teams: [], full: true }).classList.contains('full'));
});
