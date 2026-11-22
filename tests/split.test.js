import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createState, reduce, normalizeSplit, defaultSlots } from '../server/state.js';
import { startServer } from '../server/index.js';
import { parseHTML } from 'linkedom';
import { slotStyle, splitPlacement, moveRect, resizeRect, slotNames, toggleCam } from '../public/shared/split.js';
import { neededIds, visibleIds, createSourceElement, applyPlacement } from '../public/shared/sources.js';
import { fileURLToPath } from 'node:url';

const team = (i) => ({ name: `Equipo ${i}`, players: [`J${i}A`, `J${i}B`], source: { kind: 'vdo', room: `r${i}` } });
const config = {
  teams: Array.from({ length: 8 }, (_, i) => team(i + 1)),
  aerial: { name: 'Aérea', source: { kind: 'vdo', room: 'aerea' } },
};
const S = (c = config) => createState(c);
const apply = (s, ...a) => a.reduce(reduce, s);

test('con aérea: 8 equipos + cam9 + vtr + split; la aérea no tiene jugadores ni cuenta como equipo', () => {
  const s = S();
  assert.deepEqual(s.sources.map((x) => x.id), ['cam1','cam2','cam3','cam4','cam5','cam6','cam7','cam8','cam9','vtr','split']);
  assert.equal(s.sources[8].label, 'Aérea');
  assert.equal(s.sources[10].kind, 'split');
  assert.equal(apply(S(), { type: 'SET_AUDIO_MASTER', id: 'cam9' }).audioMaster, 'cam9'); // la aérea sí puede ser audio master
  assert.equal(apply(S(), { type: 'SET_AUDIO_MASTER', id: 'split' }).audioMaster, null);
});

test('AUDIO_MASTER_STEP recorre también la aérea y salta vtr y split', () => {
  let s = apply(S(), { type: 'SET_AUDIO_MASTER', id: 'cam8' }, { type: 'AUDIO_MASTER_STEP', dir: 1 });
  assert.equal(s.audioMaster, 'cam9');
  s = apply(s, { type: 'AUDIO_MASTER_STEP', dir: 1 });
  assert.equal(s.audioMaster, 'cam1');
});

// ---------- modelo de la pantalla dividida ----------
test('defaultSlots: 1..9 recuadros dentro del lienzo, sin encimarse, con cámaras asignadas en orden', () => {
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (let n = 1; n <= 9; n++) {
    const slots = defaultSlots(n, ['cam1', 'cam2', 'cam3', 'cam4', 'cam5', 'cam6', 'cam7', 'cam8', 'cam9']);
    slots.forEach((a, i) => slots.slice(i + 1).forEach((b) => assert.ok(!overlap(a, b), `n=${n}: recuadros encimados`)));
    assert.equal(slots.length, n);
    slots.forEach((s, i) => {
      assert.equal(s.cam, `cam${i + 1}`);
      assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.w <= 1.0001 && s.y + s.h <= 1.0001, `n=${n} slot ${i} dentro del lienzo`);
    });
  }
  assert.throws(() => defaultSlots(0, ['cam1']));
  assert.throws(() => defaultSlots(10, ['cam1']));
});

test('estado inicial: 2 cámaras, layouts para 2..6, sin fondos ni peleas', () => {
  const sp = S().split;
  assert.equal(sp.count, 2);
  assert.deepEqual(Object.keys(sp.layouts), ['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  assert.deepEqual(sp.layouts[2].map((x) => x.cam), ['cam1', 'cam2']);
  assert.deepEqual(sp.fights, []);
  assert.deepEqual(sp.bgs, {});
});

test('SPLIT_SET_COUNT cambia la cantidad y cada cantidad recuerda su propio arreglo', () => {
  let s = apply(S(), { type: 'SPLIT_SET_CAM', index: 0, cam: 'cam5' }, { type: 'SPLIT_SET_COUNT', count: 4 });
  assert.equal(s.split.count, 4);
  assert.equal(s.split.layouts[4].length, 4);
  s = apply(s, { type: 'SPLIT_SET_COUNT', count: 2 });
  assert.equal(s.split.layouts[2][0].cam, 'cam5');
  assert.equal(apply(s, { type: 'SPLIT_SET_COUNT', count: 0 }), s);
  assert.equal(apply(s, { type: 'SPLIT_SET_COUNT', count: 10 }), s);
  assert.equal(apply(s, { type: 'SPLIT_SET_COUNT', count: 'x' }), s);
});

test('SPLIT_SET_CAM solo acepta cámaras reales (no vtr/split/ids inventados) y un índice válido', () => {
  const s0 = S();
  assert.equal(apply(s0, { type: 'SPLIT_SET_CAM', index: 1, cam: 'cam9' }).split.layouts[2][1].cam, 'cam9');
  for (const bad of [{ index: 1, cam: 'vtr' }, { index: 1, cam: 'split' }, { index: 1, cam: 'cam99' }, { index: 5, cam: 'cam1' }, { index: -1, cam: 'cam1' }, { index: 'a', cam: 'cam1' }]) {
    assert.equal(apply(s0, { type: 'SPLIT_SET_CAM', ...bad }), s0);
  }
});

test('SPLIT_SET_RECT limita el recuadro al lienzo y a un tamaño mínimo', () => {
  let s = apply(S(), { type: 'SPLIT_SET_RECT', index: 0, x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  assert.deepEqual(s.split.layouts[2][0], { cam: 'cam1', x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  s = apply(s, { type: 'SPLIT_SET_RECT', index: 0, x: 0.9, y: 0.9, w: 0.5, h: 0.5 });
  const r = s.split.layouts[2][0];
  assert.ok(r.x + r.w <= 1.0001 && r.y + r.h <= 1.0001);
  s = apply(s, { type: 'SPLIT_SET_RECT', index: 0, x: 0, y: 0, w: 0, h: -3 });
  assert.ok(s.split.layouts[2][0].w >= 0.05 && s.split.layouts[2][0].h >= 0.05);
  const s0 = S();
  assert.equal(apply(s0, { type: 'SPLIT_SET_RECT', index: 0, x: NaN, y: 0, w: 0.3, h: 0.3 }), s0);
  assert.equal(apply(s0, { type: 'SPLIT_SET_RECT', index: 9, x: 0, y: 0, w: 0.3, h: 0.3 }), s0);
});

test('SPLIT_RESET_LAYOUT devuelve las posiciones por defecto pero conserva las cámaras', () => {
  let s = apply(S(), { type: 'SPLIT_SET_CAM', index: 0, cam: 'cam7' }, { type: 'SPLIT_SET_RECT', index: 0, x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, { type: 'SPLIT_RESET_LAYOUT' });
  assert.equal(s.split.layouts[2][0].cam, 'cam7');
  assert.deepEqual({ ...s.split.layouts[2][0], cam: undefined }, { ...defaultSlots(2, ['x', 'y'])[0], cam: undefined });
});

test('fondos: SPLIT_SET_BG solo con archivos del VTR; se detectan solos por nombre split-N.*; si se borran se limpian', () => {
  let s = apply(S(), { type: 'VTR_FILES', files: ['@tabla', 'split-2.png', 'split-4.JPG', 'otro.png', 'split-3.txt'] });
  assert.equal(s.split.bgs[2], 'split-2.png');
  assert.equal(s.split.bgs[4], 'split-4.JPG');
  assert.equal(s.split.bgs[3], undefined);
  s = apply(s, { type: 'SPLIT_SET_BG', count: 3, file: 'otro.png' });
  assert.equal(s.split.bgs[3], 'otro.png');
  assert.equal(apply(s, { type: 'SPLIT_SET_BG', count: 3, file: 'no-existe.png' }), s);
  assert.equal(apply(s, { type: 'SPLIT_SET_BG', count: 10, file: 'otro.png' }), s);
  s = apply(s, { type: 'SPLIT_SET_BG', count: 3, file: null });
  assert.equal(s.split.bgs[3], undefined);
  s = apply(s, { type: 'VTR_FILES', files: ['@tabla'] });
  assert.deepEqual(s.split.bgs, {});
});

test('peleas: guardar, cargar, reemplazar por nombre y borrar', () => {
  let s = apply(S(), { type: 'SPLIT_SET_COUNT', count: 2 }, { type: 'SPLIT_SET_CAM', index: 0, cam: 'cam2' }, { type: 'SPLIT_SET_CAM', index: 1, cam: 'cam6' }, { type: 'SPLIT_SAVE_FIGHT', name: 'Pelea 1' });
  assert.equal(s.split.fights.length, 1);
  assert.deepEqual({ name: s.split.fights[0].name, count: s.split.fights[0].count, cams: s.split.fights[0].slots.map((x) => x.cam) }, { name: 'Pelea 1', count: 2, cams: ['cam2', 'cam6'] });
  const id = s.split.fights[0].id;
  s = apply(s, { type: 'SPLIT_SET_CAM', index: 0, cam: 'cam1' }, { type: 'SPLIT_SET_COUNT', count: 4 }, { type: 'SPLIT_LOAD_FIGHT', id });
  assert.equal(s.split.count, 2);
  assert.deepEqual(s.split.layouts[2].map((x) => x.cam), ['cam2', 'cam6']);
  s = apply(s, { type: 'SPLIT_SET_CAM', index: 1, cam: 'cam8' }, { type: 'SPLIT_SAVE_FIGHT', name: 'Pelea 1' });
  assert.equal(s.split.fights.length, 1);
  assert.equal(s.split.fights[0].slots[1].cam, 'cam8');
  s = apply(s, { type: 'SPLIT_SAVE_FIGHT', name: 'Pelea 2' });
  assert.equal(s.split.fights.length, 2);
  s = apply(s, { type: 'SPLIT_DELETE_FIGHT', id });
  assert.deepEqual(s.split.fights.map((f) => f.name), ['Pelea 2']);
  assert.equal(apply(S(), { type: 'SPLIT_SAVE_FIGHT', name: '   ' }).split.fights.length, 0);
  assert.equal(apply(S(), { type: 'SPLIT_SAVE_FIGHT', name: 42 }).split.fights.length, 0);
  const s0 = S();
  assert.equal(apply(s0, { type: 'SPLIT_LOAD_FIGHT', id: 'toString' }), s0);
  assert.equal(apply(s0, { type: 'SPLIT_DELETE_FIGHT', id: 'nope' }), s0);
});

test('una pelea guardada no se corrompe al editar después (copias independientes)', () => {
  let s = apply(S(), { type: 'SPLIT_SAVE_FIGHT', name: 'P' });
  const saved = JSON.stringify(s.split.fights[0].slots);
  s = apply(s, { type: 'SPLIT_SET_RECT', index: 0, x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, { type: 'SPLIT_SET_CAM', index: 1, cam: 'cam8' });
  assert.equal(JSON.stringify(s.split.fights[0].slots), saved);
});

test('normalizeSplit repara datos guardados corruptos y conserva los válidos', () => {
  const cams = ['cam1', 'cam2', 'cam3', 'cam4', 'cam5', 'cam6', 'cam7', 'cam8', 'cam9'];
  const good = normalizeSplit({ count: 3, layouts: { 3: [{ cam: 'cam4', x: 0.1, y: 0.1, w: 0.3, h: 0.3 }, { cam: 'cam5', x: 0.5, y: 0.1, w: 0.3, h: 0.3 }, { cam: 'cam6', x: 0.3, y: 0.5, w: 0.3, h: 0.3 }] }, bgs: { 3: 'f.png' }, fights: [{ id: 'p', name: 'P', count: 2, slots: [{ cam: 'cam1', x: 0, y: 0, w: 0.4, h: 0.4 }, { cam: 'cam2', x: 0.5, y: 0, w: 0.4, h: 0.4 }] }] }, cams);
  assert.equal(good.count, 3);
  assert.equal(good.layouts[3][0].cam, 'cam4');
  assert.equal(good.bgs[3], 'f.png');
  assert.equal(good.fights.length, 1);
  for (const raw of [null, undefined, 'x', 5, [], { count: 99 }, { count: 3, layouts: { 3: 'x' } }, { layouts: { 2: [{ cam: 'vtr', x: 'a' }] } }, { fights: 'x' }, { fights: [{ id: 1 }] }]) {
    const sp = normalizeSplit(raw, cams);
    assert.ok(sp.count >= 1 && sp.count <= 9);
    for (let n = 1; n <= 9; n++) {
      assert.equal(sp.layouts[n].length, n);
      for (const s of sp.layouts[n]) assert.ok(cams.includes(s.cam) && [s.x, s.y, s.w, s.h].every(Number.isFinite));
    }
    assert.ok(Array.isArray(sp.fights));
  }
});

// ---------- persistencia ----------
test('el servidor guarda la pantalla dividida en un archivo y la recupera al arrancar', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-'));
  const file = path.join(dir, 'split.json');
  const publicDir = fileURLToPath(new URL('../public', import.meta.url));
  try {
    const a = await startServer({ port: 0, config, publicDir, splitFile: file, splitSaveDelayMs: 10 });
    a.dispatch({ type: 'SPLIT_SET_COUNT', count: 3 });
    a.dispatch({ type: 'SPLIT_SET_CAM', index: 0, cam: 'cam7' });
    a.dispatch({ type: 'SPLIT_SAVE_FIGHT', name: 'Pelea A' });
    await new Promise((r) => setTimeout(r, 150));
    await a.close();
    assert.ok(fs.existsSync(file));
    const b = await startServer({ port: 0, config, publicDir, splitFile: file });
    assert.equal(b.getState().split.count, 3);
    assert.equal(b.getState().split.layouts[3][0].cam, 'cam7');
    assert.equal(b.getState().split.fights[0].name, 'Pelea A');
    await b.close();
    fs.writeFileSync(file, '{ esto no es json');
    const c = await startServer({ port: 0, config, publicDir, splitFile: file });
    assert.equal(c.getState().split.count, 2);
    await c.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---------- render en /program ----------
test('slotStyle convierte fracciones del lienzo en porcentajes', () => {
  assert.deepEqual(slotStyle({ x: 0.1, y: 0.25, w: 0.5, h: 0.4 }), { left: '10%', top: '25%', width: '50%', height: '40%' });
});

const stWith = (extra) => ({ ...S(), ...extra });
const splitState = (over = {}) => apply(S(), { type: 'SPLIT_SET_COUNT', count: 3 }, { type: 'VTR_FILES', files: ['split-3.png'] }, ...Object.entries(over).map(([k, v]) => v));

test('neededIds/visibleIds de la pantalla dividida: sus cámaras + el fondo; preview la precarga', () => {
  let s = splitState();
  s = { ...s, program: 'split', preview: 'cam5', lastTake: null };
  assert.deepEqual([...neededIds(s, false)].sort(), ['cam1', 'cam2', 'cam3', 'cam5', 'split-bg']);
  assert.deepEqual(visibleIds(s, false).sort(), ['cam1', 'cam2', 'cam3', 'split-bg']);
  const pv = { ...s, program: 'cam5', preview: 'split' };
  assert.ok(['cam1', 'cam2', 'cam3', 'split-bg'].every((id) => neededIds(pv, false).includes(id)));
  assert.deepEqual(visibleIds(pv, false), ['cam5']);
  const sinBg = apply(S(), { type: 'SPLIT_SET_COUNT', count: 2 });
  assert.ok(!neededIds({ ...sinBg, program: 'split', preview: 'cam5', lastTake: null }, false).includes('split-bg'));
});

test('splitPlacement: con la dividida al aire cada cámara va a su recuadro; sin ella nada se posiciona', () => {
  const s = { ...splitState(), program: 'split', preview: 'cam5', lastTake: null };
  const p = splitPlacement(s, false);
  assert.deepEqual(Object.keys(p).sort(), ['cam1', 'cam2', 'cam3']);
  assert.equal(p.cam1.left, `${s.split.layouts[3][0].x * 100}%`);
  assert.deepEqual(splitPlacement({ ...s, program: 'cam5' }, false), {});
});

test('splitPlacement durante un fade desde la dividida: sus cámaras siguen en su recuadro salvo la que entra', () => {
  const s = { ...splitState(), program: 'cam2', preview: 'split', lastTake: { mode: 'fade', from: 'split', to: 'cam2', seq: 1 } };
  const p = splitPlacement(s, true);
  assert.deepEqual(Object.keys(p).sort(), ['cam1', 'cam3']);
  assert.deepEqual(splitPlacement(s, false), {});
});

// ---------- geometría del editor ----------
const R = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('moveRect mueve y no deja salir el recuadro del lienzo', () => {
  const m = moveRect(R, 0.2, 0.1);
  near(m.x, 0.3); near(m.y, 0.2); near(m.w, 0.3); near(m.h, 0.3);
  const far = moveRect(R, 5, 5);
  near(far.x, 0.7); near(far.y, 0.7);
  const neg = moveRect(R, -5, -5);
  near(neg.x, 0); near(neg.y, 0);
});

test('resizeRect con 16:9 bloqueado: el alto sigue al ancho; respeta mínimo y bordes', () => {
  const a = resizeRect(R, 0.1, 0, true);
  near(a.w, 0.4); near(a.h, 0.4);
  const edge = resizeRect({ x: 0.8, y: 0.8, w: 0.1, h: 0.1 }, 0.5, 0.5, true);
  near(edge.w, 0.2); near(edge.h, 0.2);
  const tiny = resizeRect(R, -1, -1, true);
  near(tiny.w, 0.05); near(tiny.h, 0.05);
});

test('resizeRect libre: ancho y alto independientes', () => {
  const f = resizeRect(R, 0.1, -0.1, false);
  near(f.w, 0.4); near(f.h, 0.2);
  assert.deepEqual({ x: f.x, y: f.y }, { x: 0.1, y: 0.1 });
});

// ---------- DOM de /program ----------
const domMount = (ids) => {
  const { document } = parseHTML('<div id="c"></div>');
  global.document = document;
  const c = document.getElementById('c');
  for (const id of ids) c.append(createSourceElement({ id, kind: 'vdo' }, { url: 'https://x/' }));
  return c;
};

test('applyPlacement posiciona cada cámara en su recuadro y deja limpias a las demás', () => {
  const c = domMount(['cam1', 'cam2']);
  const at = (id) => c.querySelector(`[data-source-id="${id}"]`);
  applyPlacement(c, { cam1: { left: '10%', top: '20%', width: '30%', height: '40%' } });
  assert.equal(at('cam1').style.left, '10%');
  assert.equal(at('cam1').style.height, '40%');
  assert.ok(at('cam1').classList.contains('split-cam'));
  assert.equal(at('cam2').style.left, '');
  assert.ok(!at('cam2').classList.contains('split-cam'));
  applyPlacement(c, {});
  assert.equal(at('cam1').style.left, '');
  assert.ok(!at('cam1').classList.contains('split-cam'));
});

test('createSourceElement: fondo imagen o video, y la vista de la dividida', () => {
  domMount([]);
  const img = createSourceElement({ id: 'split-bg', kind: 'bg' }, { url: '/vtr/split-2.png' });
  assert.equal(img.tagName, 'IMG');
  assert.equal(img.dataset.sourceId, 'split-bg');
  assert.ok(img.classList.contains('split-bg'));
  const vid = createSourceElement({ id: 'split-bg', kind: 'bg' }, { url: '/vtr/split-2.MP4' });
  assert.equal(vid.tagName, 'VIDEO');
  assert.equal(vid.muted, true);
  assert.equal(vid.loop, true);
  const view = createSourceElement({ id: 'split', kind: 'split' }, {});
  assert.equal(view.tagName, 'DIV');
  assert.ok(view.classList.contains('split-view'));
});

// ---------- elegir cámaras con botones ----------
test('SPLIT_SET_CAMS: la cantidad sale de cuántas eliges y van en el orden en que las eliges', () => {
  let s = apply(S(), { type: 'SPLIT_SET_CAMS', cams: ['cam1', 'cam4'] });
  assert.equal(s.split.count, 2);
  assert.deepEqual(s.split.layouts[2].map((x) => x.cam), ['cam1', 'cam4']);
  s = apply(s, { type: 'SPLIT_SET_CAMS', cams: ['cam1', 'cam4', 'cam9'] });
  assert.equal(s.split.count, 3);
  assert.deepEqual(s.split.layouts[3].map((x) => x.cam), ['cam1', 'cam4', 'cam9']);
  s = apply(s, { type: 'SPLIT_SET_CAMS', cams: ['cam3'] });
  assert.equal(s.split.count, 1);
  const nine = Array.from({ length: 9 }, (_, i) => `cam${i + 1}`);
  assert.equal(apply(s, { type: 'SPLIT_SET_CAMS', cams: nine }).split.count, 9);
});

test('SPLIT_SET_CAMS conserva las posiciones que ya habías ajustado para esa cantidad', () => {
  let s = apply(S(), { type: 'SPLIT_SET_RECT', index: 0, x: 0.05, y: 0.05, w: 0.3, h: 0.3 });
  const before = s.split.layouts[2][0];
  s = apply(s, { type: 'SPLIT_SET_CAMS', cams: ['cam7', 'cam8'] });
  assert.equal(s.split.layouts[2][0].cam, 'cam7');
  assert.deepEqual({ x: s.split.layouts[2][0].x, w: s.split.layouts[2][0].w }, { x: before.x, w: before.w });
});

test('SPLIT_SET_CAMS ignora listas inválidas: vacía, repetidas, no cámaras, demasiadas o no-arreglo', () => {
  const s0 = S();
  for (const cams of [[], ['cam1', 'cam1'], ['cam1', 'vtr'], ['cam1', 'split'], ['cam99'], 'cam1', null, undefined, 5, Array.from({ length: 10 }, (_, i) => `cam${i + 1}`)]) {
    assert.equal(apply(s0, { type: 'SPLIT_SET_CAMS', cams }), s0);
  }
});

test('slotNames da un nombre de posición por recuadro (Izquierda/Derecha para 2)', () => {
  assert.deepEqual(slotNames(2), ['Izquierda', 'Derecha']);
  assert.deepEqual(slotNames(1), ['Centro']);
  for (let n = 1; n <= 9; n++) assert.equal(slotNames(n).length, n);
  assert.equal(new Set(slotNames(9)).size, 9);
});

test('toggleCam agrega al final, quita si ya estaba, no pasa de 9 ni deja la lista vacía', () => {
  assert.deepEqual(toggleCam(['cam1'], 'cam4'), ['cam1', 'cam4']);
  assert.deepEqual(toggleCam(['cam1', 'cam4'], 'cam1'), ['cam4']);
  assert.deepEqual(toggleCam(['cam4'], 'cam4'), ['cam4']);
  const nine = Array.from({ length: 9 }, (_, i) => `cam${i + 1}`);
  assert.deepEqual(toggleCam(nine, 'cam10'), nine);
});
