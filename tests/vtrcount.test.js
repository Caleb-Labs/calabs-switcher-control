import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtClock, vtrCounter, WARN_SECONDS } from '../public/shared/vtrcount.js';

const playing = (pos = 0, since = 0) => ({ files: ['a.mp4'], current: 'a.mp4', playing: true, pos, since });
const paused = (pos) => ({ files: ['a.mp4'], current: 'a.mp4', playing: false, pos, since: null });

test('fmtClock: MM:SS, y H:MM:SS desde la hora', () => {
  assert.equal(fmtClock(0), '00:00');
  assert.equal(fmtClock(59), '00:59');
  assert.equal(fmtClock(148), '02:28');
  assert.equal(fmtClock(3600), '1:00:00');
  assert.equal(fmtClock(3725), '1:02:05');
  assert.equal(fmtClock(-5), '00:00');
  assert.equal(fmtClock(NaN), '00:00');
});

test('el contador muestra lo que falta y el total: -02:28 / 03:10', () => {
  const c = vtrCounter(playing(), 190, 42300);
  assert.equal(c.text, '-02:28 / 03:10');
  assert.equal(c.warn, false);
  assert.equal(c.paused, false);
});

test('lo que falta se redondea hacia arriba, así llega a 00:00 justo al final', () => {
  assert.equal(vtrCounter(playing(), 190, 0).text, '-03:10 / 03:10');
  assert.equal(vtrCounter(playing(), 190, 189500).text, '-00:01 / 03:10');
  assert.equal(vtrCounter(playing(), 190, 190000).text, '-00:00 / 03:10');
  assert.equal(vtrCounter(playing(), 190, 999000).text, '-00:00 / 03:10'); // pasado el final no baja de cero
});

test('avisa (warn) en los últimos 10 segundos, y no antes', () => {
  assert.equal(WARN_SECONDS, 10);
  assert.equal(vtrCounter(playing(), 190, 179000).warn, false); // faltan 11
  assert.equal(vtrCounter(playing(), 190, 180000).warn, true);  // faltan 10
  assert.equal(vtrCounter(playing(), 190, 189000).warn, true);
});

test('en pausa el contador se congela en la posición del reloj y no corre', () => {
  const a = vtrCounter(paused(100), 190, 5000);
  const b = vtrCounter(paused(100), 190, 99999);
  assert.equal(a.text, '-01:30 / 03:10');
  assert.equal(b.text, a.text);
  assert.equal(a.paused, true);
  assert.equal(a.warn, false);
});

test('en pausa dentro de los últimos 10 s sigue marcado como aviso (pero pausado, para que no parpadee)', () => {
  const c = vtrCounter(paused(185), 190, 0);
  assert.equal(c.text, '-00:05 / 03:10');
  assert.equal(c.warn, true);
  assert.equal(c.paused, true);
});

test('coincide con la posición que usan las demás pantallas (mismo reloj)', () => {
  // reproduciendo desde pos 20 s arrancado a las 1000 ms; a las 11000 ms van 30 s
  assert.equal(vtrCounter(playing(20, 1000), 100, 11000).text, '-01:10 / 01:40');
});

test('sin video, con imagen o con duración desconocida no hay contador', () => {
  assert.equal(vtrCounter({ files: [], current: null, playing: false, pos: 0, since: null }, 190, 0), null);
  assert.equal(vtrCounter({ files: ['a.png'], current: 'a.png', playing: true, pos: 0, since: 0 }, 190, 0), null);
  assert.equal(vtrCounter({ files: ['@tabla'], current: '@tabla', playing: false, pos: 0, since: null }, 190, 0), null);
  for (const d of [NaN, 0, -1, Infinity, undefined]) assert.equal(vtrCounter(playing(), d, 0), null, String(d));
});
