import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createState, reduce, normalizeSplit } from '../server/state.js';
import { syncGraphics } from '../public/graphics/layer.js';
import { slotGcPlacement } from '../public/shared/split.js';
import { volumeFor, neededIds } from '../public/shared/sources.js';
import { vtrAudioStatus } from '../public/shared/vtr.js';
import { commandToAction } from '../server/commands.js';

const team = (i) => ({ name: `Equipo ${i}`, players: [`J${i}A`, `J${i}B`], source: { kind: 'vdo', room: `r${i}` } });
const config = { teams: Array.from({ length: 8 }, (_, i) => team(i + 1)), aerial: { name: 'Aérea', source: { kind: 'vdo', room: 'a' } } };
const S = (c = config) => createState(c);
const apply = (s, ...a) => a.reduce(reduce, s);

// ---------- GC principales movibles ----------
test('GC_SET_POS guarda la posición de los GC principales (solo name/score) dentro del lienzo', () => {
  let s = apply(S(), { type: 'GC_SET_POS', gcId: 'name', x: 0.5, y: 0.25 });
  assert.deepEqual(s.gcPos.name, { x: 0.5, y: 0.25 });
  assert.equal(s.gcPos.score, null);
  s = apply(s, { type: 'GC_SET_POS', gcId: 'score', x: 5, y: -3 });
  assert.deepEqual(s.gcPos.score, { x: 0.95, y: 0 });
  const s0 = S();
  for (const bad of [{ gcId: 'otro', x: 0, y: 0 }, { gcId: 'toString', x: 0, y: 0 }, { gcId: 'name', x: NaN, y: 0 }, { gcId: 'name', x: 'a', y: 0 }]) {
    assert.equal(apply(s0, { type: 'GC_SET_POS', ...bad }), s0);
  }
});

test('GC con posición propia se dibuja ahí; sin posición usa la del diseño', () => {
  const { document } = parseHTML('<div id="c"></div>');
  global.document = document;
  const c = document.getElementById('c');
  let s = apply(S(), { type: 'GC_ARM', gcId: 'name', template: 'gc-name', data: { team: 'A', player: 'p' } }, { type: 'GC_LIVE', gcId: 'name' });
  syncGraphics(c, s, 'live');
  assert.equal(c.firstElementChild.style.left, '');
  s = apply(s, { type: 'GC_SET_POS', gcId: 'name', x: 0.5, y: 0.25 });
  syncGraphics(c, s, 'live');
  assert.equal(c.firstElementChild.style.left, '960px');
  assert.equal(c.firstElementChild.style.top, '270px');
  assert.equal(c.firstElementChild.style.bottom, 'auto');
});

// ---------- GC por recuadro en la pantalla dividida ----------
test('slotGcPlacement ubica el GC dentro del recuadro y lo achica si el recuadro es chico', () => {
  assert.deepEqual(slotGcPlacement({ x: 0.01, y: 0.26, w: 0.48, h: 0.48 }, { x: 0.03, y: 0.78 }), { left: 47, top: 685, k: 1 });
  const small = slotGcPlacement({ x: 0.03, y: 0.12, w: 0.22, h: 0.22 }, { x: 0, y: 0 });
  assert.ok(small.k < 0.7 && small.k >= 0.25);
  assert.equal(small.left, 58);
});

test('al crear el estado, cada recuadro trae el nombre del equipo de su cámara como texto', () => {
  const sp = S().split;
  assert.deepEqual(sp.texts[2].map((t) => t.title), ['Equipo 1', 'Equipo 2']);
  assert.equal(sp.texts[2][0].subtitle, '');
  assert.equal(sp.gcOffs[2].length, 2);
  assert.equal(Object.keys(sp.texts).length, 9);
});

test('SPLIT_SET_TEXT edita el texto de un recuadro (recortado) y valida el índice', () => {
  let s = apply(S(), { type: 'SPLIT_SET_TEXT', index: 1, title: 'Los Piratas', subtitle: 'Capitán Jack' });
  assert.deepEqual(s.split.texts[2][1], { title: 'Los Piratas', subtitle: 'Capitán Jack' });
  s = apply(s, { type: 'SPLIT_SET_TEXT', index: 0, title: 'x'.repeat(200), subtitle: 5 });
  assert.equal(s.split.texts[2][0].title.length, 60);
  assert.equal(s.split.texts[2][0].subtitle, '');
  const s0 = S();
  for (const bad of [{ index: 5 }, { index: -1 }, { index: 'a' }]) assert.equal(apply(s0, { type: 'SPLIT_SET_TEXT', ...bad, title: 'a', subtitle: 'b' }), s0);
});

test('al cambiar la cámara de un recuadro, el texto automático (nombre del equipo) la sigue; uno escrito a mano se respeta', () => {
  let s = apply(S(), { type: 'SPLIT_SET_CAM', index: 0, cam: 'cam5' });
  assert.equal(s.split.texts[2][0].title, 'Equipo 5');
  s = apply(s, { type: 'SPLIT_SET_TEXT', index: 0, title: 'Final: Los Piratas', subtitle: '' }, { type: 'SPLIT_SET_CAM', index: 0, cam: 'cam7' });
  assert.equal(s.split.texts[2][0].title, 'Final: Los Piratas');
  s = apply(S(), { type: 'SPLIT_SET_CAMS', cams: ['cam3', 'cam6'] });
  assert.deepEqual(s.split.texts[2].map((t) => t.title), ['Equipo 3', 'Equipo 6']);
  s = apply(s, { type: 'SPLIT_SET_CAMS', cams: ['cam3', 'cam9', 'cam1'] });
  assert.deepEqual(s.split.texts[3].map((t) => t.title), ['Equipo 3', '', 'Equipo 1']); // la aérea no tiene equipo
});

test('SPLIT_SET_GCPOS mueve el GC dentro de su recuadro (fracciones del recuadro, con límites)', () => {
  let s = apply(S(), { type: 'SPLIT_SET_GCPOS', index: 0, x: 0.2, y: 0.5 });
  assert.deepEqual(s.split.gcOffs[2][0], { x: 0.2, y: 0.5 });
  s = apply(s, { type: 'SPLIT_SET_GCPOS', index: 0, x: 9, y: -9 });
  assert.deepEqual(s.split.gcOffs[2][0], { x: 0.95, y: 0 });
  const s0 = S();
  for (const bad of [{ index: 9, x: 0, y: 0 }, { index: 0, x: NaN, y: 0 }]) assert.equal(apply(s0, { type: 'SPLIT_SET_GCPOS', ...bad }), s0);
});

test('SPLIT_GC cambia el estado de los GC de la dividida: off | preview | live', () => {
  assert.equal(S().splitGc, 'off');
  assert.equal(apply(S(), { type: 'SPLIT_GC', to: 'live' }).splitGc, 'live');
  assert.equal(apply(S(), { type: 'SPLIT_GC', to: 'preview' }).splitGc, 'preview');
  const s0 = S();
  assert.equal(apply(s0, { type: 'SPLIT_GC', to: 'nope' }), s0);
});

function mount(state, which) {
  const { document } = parseHTML('<div id="c"></div>');
  global.document = document;
  const c = document.getElementById('c');
  syncGraphics(c, state, which);
  return c;
}
const ids = (c) => [...c.children].map((e) => e.dataset.gcId);

test('los GC de la dividida salen solo si la dividida está al aire (live) o en preview (preview), uno por recuadro', () => {
  const base = apply(S(), { type: 'SPLIT_SET_CAMS', cams: ['cam1', 'cam2', 'cam3'] }, { type: 'SPLIT_GC', to: 'live' });
  assert.deepEqual(ids(mount({ ...base, program: 'cam1', preview: 'split' }, 'live')), []);
  const onAir = mount({ ...base, program: 'split', preview: 'cam4' }, 'live');
  assert.deepEqual(ids(onAir), ['split-gc-0', 'split-gc-1', 'split-gc-2']);
  assert.match(onAir.children[0].textContent, /Equipo 1/);
  assert.notEqual(onAir.children[0].style.left, '');
  const pv = apply(base, { type: 'SPLIT_GC', to: 'preview' });
  assert.deepEqual(ids(mount({ ...pv, program: 'cam1', preview: 'split' }, 'preview')), ['split-gc-0', 'split-gc-1', 'split-gc-2']);
  assert.deepEqual(ids(mount({ ...pv, program: 'cam1', preview: 'split' }, 'live')), []);
  const off = apply(base, { type: 'SPLIT_GC', to: 'off' });
  assert.deepEqual(ids(mount({ ...off, program: 'split', preview: 'cam4' }, 'live')), []);
});

test('un recuadro sin texto no muestra GC y el texto se inserta como texto (no HTML)', () => {
  let s = apply(S(), { type: 'SPLIT_SET_TEXT', index: 0, title: '', subtitle: '' }, { type: 'SPLIT_SET_TEXT', index: 1, title: '<img src=x onerror=alert(1)>', subtitle: '' }, { type: 'SPLIT_GC', to: 'live' });
  const c = mount({ ...s, program: 'split', preview: 'cam4' }, 'live');
  assert.deepEqual(ids(c), ['split-gc-1']);
  assert.equal(c.querySelectorAll('img').length, 0);
});

test('las peleas guardan y recuperan también los textos y la posición de sus GC', () => {
  let s = apply(S(), { type: 'SPLIT_SET_TEXT', index: 0, title: 'Pelea 1 A', subtitle: 'x' }, { type: 'SPLIT_SET_GCPOS', index: 0, x: 0.5, y: 0.5 }, { type: 'SPLIT_SAVE_FIGHT', name: 'P1' });
  const id = s.split.fights[0].id;
  s = apply(s, { type: 'SPLIT_SET_TEXT', index: 0, title: 'otro', subtitle: '' }, { type: 'SPLIT_SET_GCPOS', index: 0, x: 0, y: 0 }, { type: 'SPLIT_LOAD_FIGHT', id });
  assert.deepEqual(s.split.texts[2][0], { title: 'Pelea 1 A', subtitle: 'x' });
  assert.deepEqual(s.split.gcOffs[2][0], { x: 0.5, y: 0.5 });
});

test('normalizeSplit repara textos y posiciones corruptos', () => {
  const cams = ['cam1', 'cam2', 'cam3'];
  const sp = normalizeSplit({ texts: { 2: [{ title: 5, subtitle: null }, 'x'], 3: 'nope' }, gcOffs: { 2: [{ x: 'a', y: 99 }] } }, cams);
  assert.equal(sp.texts[2].length, 2);
  assert.deepEqual(sp.texts[2][0], { title: '', subtitle: '' });
  assert.equal(sp.texts[3].length, 3);
  assert.equal(sp.gcOffs[2].length, 2);
  for (const o of sp.gcOffs[2]) assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y) && o.x <= 0.95 && o.y <= 0.95);
});

// ---------- mezclador de audio ----------
const base = { program: 'cam1', preview: 'cam2', lastTake: null, audioMaster: null, vtr: { playing: false } };

test('estado inicial del mezclador: una entrada por cámara (no vtr/split), apagadas y a nivel 1', () => {
  const m = S().mix;
  assert.deepEqual(Object.keys(m), ['cam1', 'cam2', 'cam3', 'cam4', 'cam5', 'cam6', 'cam7', 'cam8', 'cam9']);
  assert.deepEqual(m.cam1, { level: 1, on: false });
});

test('MIX_TOGGLE y MIX_LEVEL: varias cámaras pueden sonar a la vez, cada una con su nivel', () => {
  let s = apply(S(), { type: 'MIX_TOGGLE', id: 'cam2' }, { type: 'MIX_TOGGLE', id: 'cam5' }, { type: 'MIX_LEVEL', id: 'cam5', level: 0.4 });
  assert.equal(s.mix.cam2.on, true);
  assert.equal(s.mix.cam5.on, true);
  assert.equal(s.mix.cam5.level, 0.4);
  s = apply(s, { type: 'MIX_TOGGLE', id: 'cam2' }, { type: 'MIX_LEVEL', id: 'cam5', level: 9 });
  assert.equal(s.mix.cam2.on, false);
  assert.equal(s.mix.cam5.level, 1);
  const s0 = S();
  for (const bad of [{ type: 'MIX_TOGGLE', id: 'vtr' }, { type: 'MIX_TOGGLE', id: 'split' }, { type: 'MIX_TOGGLE', id: 'toString' }, { type: 'MIX_LEVEL', id: 'cam1', level: NaN }, { type: 'MIX_LEVEL', id: 'nope', level: 0.5 }]) {
    assert.equal(apply(s0, bad), s0);
  }
});

test('SET_VOLUME fija el nivel general de cámaras o del VTR (0..1)', () => {
  let s = apply(S(), { type: 'SET_VOLUME', target: 'vtr', level: 0.35 });
  assert.equal(s.audio.vtr.level, 0.35);
  s = apply(s, { type: 'SET_VOLUME', target: 'cam', level: 7 });
  assert.equal(s.audio.cam.level, 1);
  const s0 = S();
  assert.equal(apply(s0, { type: 'SET_VOLUME', target: 'x', level: 0.5 }), s0);
  assert.equal(apply(s0, { type: 'SET_VOLUME', target: 'cam', level: 'a' }), s0);
});

test('volumeFor: suena el audio master y toda cámara encendida en el mezclador, cada una con su nivel', () => {
  let s = apply(S(), { type: 'SET_AUDIO_MASTER', id: 'cam3' }, { type: 'MIX_TOGGLE', id: 'cam5' }, { type: 'MIX_LEVEL', id: 'cam5', level: 0.5 });
  assert.equal(volumeFor(s, 'cam3'), 1);
  assert.equal(volumeFor(s, 'cam5'), 0.5);
  assert.equal(volumeFor(s, 'cam1'), 0);
  s = apply(s, { type: 'SET_VOLUME', target: 'cam', level: 0.5 });
  assert.equal(volumeFor(s, 'cam5'), 0.25);
  s = apply(s, { type: 'TOGGLE_MUTE', target: 'cam' });
  assert.equal(volumeFor(s, 'cam5'), 0);
  assert.equal(volumeFor({ ...base }, 'cam1'), 0); // estados sin mezclador siguen funcionando
});

test('neededIds monta (ocultas) todas las cámaras con audio encendido', () => {
  const s = { ...apply(S(), { type: 'MIX_TOGGLE', id: 'cam6' }, { type: 'MIX_TOGGLE', id: 'cam7' }), program: 'cam1', preview: 'cam2', lastTake: null };
  assert.deepEqual(neededIds(s, false), ['cam1', 'cam2', 'cam6', 'cam7']);
});

// ---------- estado del audio del VTR ----------
test('vtrAudioStatus explica por qué suena o no el VTR', () => {
  const st = (over) => ({ program: 'cam1', vtr: { current: 'a.mp4', playing: false }, audio: { vtr: { level: 1, muted: false } }, ...over });
  assert.match(vtrAudioStatus(st({ vtr: { current: null, playing: false } })).text, /sin archivo/i);
  assert.match(vtrAudioStatus(st({ vtr: { current: 'logo.png', playing: true } })).text, /sin audio/i);
  assert.match(vtrAudioStatus(st({})).text, /pausa/i);
  assert.match(vtrAudioStatus(st({ vtr: { current: 'a.mp4', playing: true } })).text, /NO está al aire/);
  const live = vtrAudioStatus(st({ program: 'vtr', vtr: { current: 'a.mp4', playing: true } }));
  assert.match(live.text, /sonando/i);
  assert.equal(live.live, true);
  assert.match(vtrAudioStatus(st({ program: 'vtr', vtr: { current: 'a.mp4', playing: true }, audio: { vtr: { level: 1, muted: true } } })).text, /silenciado/i);
  assert.match(vtrAudioStatus(st({ program: 'vtr', vtr: { current: 'a.mp4', playing: true }, audio: { vtr: { level: 0, muted: false } } })).text, /silenciado/i);
});

// ---------- comandos del macropad ----------
test('comandos para los GC de la dividida', () => {
  assert.deepEqual(commandToAction('split-gc-preview'), { type: 'SPLIT_GC', to: 'preview' });
  assert.deepEqual(commandToAction('split-gc-live'), { type: 'SPLIT_GC', to: 'live' });
  assert.deepEqual(commandToAction('split-gc-off'), { type: 'SPLIT_GC', to: 'off' });
});

test('GC_RESET_POS devuelve un GC principal a su posición original', () => {
  let s = apply(S(), { type: 'GC_SET_POS', gcId: 'name', x: 0.5, y: 0.5 }, { type: 'GC_RESET_POS', gcId: 'name' });
  assert.equal(s.gcPos.name, null);
  const s0 = S();
  assert.equal(apply(s0, { type: 'GC_RESET_POS', gcId: 'nope' }), s0);
});

// ---------- los gráficos se escalan como un solo lienzo 1920x1080 ----------
import { applyScale } from '../public/graphics/layer.js';

test('applyScale escala el lienzo completo (posiciones incluidas) según el ancho del contenedor padre', () => {
  const stage = { style: {}, parentElement: { clientWidth: 960 } };
  applyScale(stage);
  assert.equal(stage.style.transform, 'scale(0.5)');
  assert.equal(stage.style.transformOrigin, '0 0');
  assert.equal(stage.style.width, '1920px');
  assert.equal(stage.style.height, '1080px');
  const full = { style: {}, parentElement: { clientWidth: 1920 } };
  applyScale(full);
  assert.equal(full.style.transform, '');
  const none = { style: {}, parentElement: { clientWidth: 0 } };
  assert.doesNotThrow(() => applyScale(none));
});

// ---------- fade con duración ----------
test('TAKE guarda la duración del fade en lastTake.ms (0 para un corte)', () => {
  let s = apply(S(), { type: 'TAKE', mode: 'fade' });
  assert.equal(s.lastTake.ms, 500);
  s = apply(S(), { type: 'FADE_TIME', ms: 2000 }, { type: 'TAKE', mode: 'fade' });
  assert.equal(s.lastTake.ms, 2000);
  assert.equal(apply(S(), { type: 'FADE_TIME', ms: 2000 }, { type: 'TAKE', mode: 'cut' }).lastTake.ms, 0);
});

test('FADE_TIME fija la duración (100 ms a 5 s) y FADE_STEP la sube o baja de 100 en 100', () => {
  assert.equal(S().fadeMs, 500);
  assert.equal(apply(S(), { type: 'FADE_TIME', ms: 99999 }).fadeMs, 5000);
  assert.equal(apply(S(), { type: 'FADE_TIME', ms: 1 }).fadeMs, 100);
  assert.equal(apply(S(), { type: 'FADE_STEP', dir: 1 }).fadeMs, 600);
  assert.equal(apply(S(), { type: 'FADE_STEP', dir: -1 }).fadeMs, 400);
  assert.equal(apply(S(), { type: 'FADE_TIME', ms: 100 }, { type: 'FADE_STEP', dir: -1 }).fadeMs, 100);
  const s0 = S();
  assert.equal(apply(s0, { type: 'FADE_TIME', ms: 'x' }), s0);
  assert.equal(apply(s0, { type: 'FADE_TIME', ms: NaN }), s0);
});

// ---------- selección de cámara para los diales de audio ----------
test('mixSel: la cámara seleccionada para los diales (empieza en cam1) y MIX_SELECT la recorre dando la vuelta', () => {
  assert.equal(S().mixSel, 'cam1');
  assert.equal(apply(S(), { type: 'MIX_SELECT', dir: 1 }).mixSel, 'cam2');
  assert.equal(apply(S(), { type: 'MIX_SELECT', dir: -1 }).mixSel, 'cam9');
  assert.equal(apply(S(), { type: 'MIX_SELECT', dir: -1 }, { type: 'MIX_SELECT', dir: 1 }).mixSel, 'cam1');
});

test('MIX_ADJUST sube o baja el volumen de la cámara seleccionada; MIX_SEL_TOGGLE la enciende o apaga', () => {
  let s = apply(S(), { type: 'MIX_SELECT', dir: 1 }, { type: 'MIX_ADJUST', delta: -0.25 });
  assert.equal(s.mix.cam2.level, 0.75);
  assert.equal(s.mix.cam1.level, 1);
  s = apply(s, { type: 'MIX_ADJUST', delta: -5 });
  assert.equal(s.mix.cam2.level, 0);
  s = apply(s, { type: 'MIX_SEL_TOGGLE' });
  assert.equal(s.mix.cam2.on, true);
  s = apply(s, { type: 'MIX_SEL_TOGGLE' });
  assert.equal(s.mix.cam2.on, false);
  s = apply(S(), { type: 'SET_AUDIO_MASTER', id: 'cam1' }, { type: 'MIX_SEL_TOGGLE' }); // cam1 era master: apagarla la quita
  assert.equal(s.audioMaster, null);
  assert.equal(s.mix.cam1.on, false);
  const s0 = S();
  assert.equal(apply(s0, { type: 'MIX_ADJUST', delta: NaN }), s0);
});

// ---------- bip de prueba de audio ----------
test('TEST_TONE incrementa toneSeq para que /program emita un bip (comprueba que OBS recibe audio)', () => {
  assert.equal(S().toneSeq, 0);
  assert.equal(apply(S(), { type: 'TEST_TONE' }, { type: 'TEST_TONE' }).toneSeq, 2);
});

test('comandos del macropad: fade más largo/corto, selección de cámara de audio y su volumen', () => {
  assert.deepEqual(commandToAction('fade-longer'), { type: 'FADE_STEP', dir: 1 });
  assert.deepEqual(commandToAction('fade-shorter'), { type: 'FADE_STEP', dir: -1 });
  assert.deepEqual(commandToAction('mix-next'), { type: 'MIX_SELECT', dir: 1 });
  assert.deepEqual(commandToAction('mix-prev'), { type: 'MIX_SELECT', dir: -1 });
  assert.deepEqual(commandToAction('mix-up'), { type: 'MIX_ADJUST', delta: 0.05 });
  assert.deepEqual(commandToAction('mix-down'), { type: 'MIX_ADJUST', delta: -0.05 });
  assert.deepEqual(commandToAction('mix-toggle'), { type: 'MIX_SEL_TOGGLE' });
  assert.deepEqual(commandToAction('test-tone'), { type: 'TEST_TONE' });
});

test('SPLIT_RESET_LAYOUT también devuelve los GC del recuadro a su posición original', () => {
  let s = apply(S(), { type: 'SPLIT_SET_GCPOS', index: 0, x: 0.5, y: 0.5 }, { type: 'SPLIT_SET_RECT', index: 0, x: 0.3, y: 0.3, w: 0.2, h: 0.2 }, { type: 'SPLIT_RESET_LAYOUT' });
  assert.deepEqual(s.split.gcOffs[2][0], { x: 0.03, y: 0.78 });
  assert.deepEqual(s.split.layouts[2][0], { cam: 'cam1', x: 0.01, y: 0.26, w: 0.48, h: 0.48 });
  const other = apply(S(), { type: 'SPLIT_SET_COUNT', count: 3 }, { type: 'SPLIT_SET_GCPOS', index: 0, x: 0.4, y: 0.4 }, { type: 'SPLIT_SET_COUNT', count: 2 }, { type: 'SPLIT_RESET_LAYOUT' });
  assert.deepEqual(other.split.gcOffs[3][0], { x: 0.4, y: 0.4 }); // solo la cantidad en edición
});

// ---------- emergencia con foto o video ----------
import { renderGraphic } from '../public/graphics/templates.js';
import { persistable } from '../server/state.js';
import { startServer } from '../server/index.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('EMERGENCY_FILE elige el archivo de la emergencia (solo archivos del VTR) y null lo quita', () => {
  let s = apply(S(), { type: 'VTR_FILES', files: ['@tabla', 'emergencia.mp4', 'logo.png'] });
  s = apply(s, { type: 'EMERGENCY_FILE', file: 'emergencia.mp4' });
  assert.equal(s.emergencyFile, 'emergencia.mp4');
  assert.equal(apply(s, { type: 'EMERGENCY_FILE', file: 'nope.png' }), s);
  assert.equal(apply(s, { type: 'EMERGENCY_FILE', file: '@tabla' }), s);
  assert.equal(apply(s, { type: 'EMERGENCY_FILE', file: null }).emergencyFile, null);
  assert.equal(apply(s, { type: 'VTR_FILES', files: ['@tabla', 'logo.png'] }).emergencyFile, null); // si se borra el archivo, vuelve al logo/texto
});

test('la plantilla de emergencia usa el archivo elegido: video en bucle, imagen o, si no hay, el logo de la config', () => {
  const { document } = parseHTML('<div></div>');
  global.document = document;
  const v = renderGraphic('emergency', { file: 'aviso.MP4', logo: '/vtr/logo.png' });
  assert.equal(v.querySelector('video').getAttribute('src'), '/vtr/aviso.MP4');
  assert.equal(v.querySelector('video').loop, true);
  assert.equal(v.querySelector('img'), null);
  const i = renderGraphic('emergency', { file: 'foto 1.png', logo: '/vtr/logo.png' });
  assert.equal(i.querySelector('img').getAttribute('src'), '/vtr/foto%201.png');
  assert.equal(renderGraphic('emergency', { logo: '/vtr/logo.png' }).querySelector('img').getAttribute('src'), '/vtr/logo.png');
  assert.match(renderGraphic('emergency', {}).textContent, /VOLVEMOS/);
});

test('persistable agrupa lo que se guarda en disco y conserva referencias si nada cambió', () => {
  const s = S();
  const a = persistable(s);
  assert.deepEqual(Object.keys(a).sort(), ['emergencyFile', 'gcPos', 'split']);
  assert.equal(persistable(apply(s, { type: 'TAKE', mode: 'cut' })).split, a.split);
});

test('el servidor guarda y recupera la emergencia junto con lo demás', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'em-'));
  const file = path.join(dir, 'show.json');
  const publicDir = fileURLToPath(new URL('../public', import.meta.url));
  try {
    const a = await startServer({ port: 0, config, publicDir, splitFile: file, splitSaveDelayMs: 10 });
    a.dispatch({ type: 'VTR_FILES', files: ['@tabla', 'aviso.mp4'] });
    a.dispatch({ type: 'EMERGENCY_FILE', file: 'aviso.mp4' });
    a.dispatch({ type: 'GC_SET_POS', gcId: 'name', x: 0.3, y: 0.4 });
    await new Promise((r) => setTimeout(r, 120));
    await a.close();
    const b = await startServer({ port: 0, config, publicDir, splitFile: file });
    assert.equal(b.getState().emergencyFile, 'aviso.mp4');
    assert.deepEqual(b.getState().gcPos.name, { x: 0.3, y: 0.4 });
    await b.close();
    // formato antiguo (solo la pantalla dividida) sigue funcionando
    fs.writeFileSync(file, JSON.stringify({ count: 4, layouts: {} }));
    const c = await startServer({ port: 0, config, publicDir, splitFile: file });
    assert.equal(c.getState().split.count, 4);
    await c.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
