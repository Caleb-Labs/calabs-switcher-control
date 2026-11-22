import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loudnessFromMessage, levelPct, rmsPct, stepMeter, newMeter, SEGMENTS } from '../public/shared/meter.js';

const sources = [
  { id: 'cam1', url: 'https://vdo.ninja/?view=sala1&mutespeaker=&getloudness=' },
  { id: 'cam2', url: 'https://vdo.ninja/?view=sala%202' },
  { id: 'vtr', url: null },
];
const ev = (data, origin = 'https://vdo.ninja') => ({ origin, data });

test('loudnessFromMessage devuelve la cámara y su nivel (el mayor de los canales reportados)', () => {
  assert.deepEqual(loudnessFromMessage(ev({ action: 'loudness', loudness: { sala1: 12 } }), sources), { id: 'cam1', value: 12 });
  assert.deepEqual(loudnessFromMessage(ev({ action: 'loudness', loudness: { 'sala 2': 5, otra: 30 } }), sources), { id: 'cam2', value: 5 });
});

test('loudnessFromMessage ignora lo que no es nivel, otros orígenes y salas desconocidas', () => {
  assert.equal(loudnessFromMessage(ev({ action: 'loudness', loudness: { sala1: 12 } }, 'https://evil.example'), sources), null);
  assert.equal(loudnessFromMessage(ev({ action: 'view-connection', streamID: 'sala1' }), sources), null);
  assert.equal(loudnessFromMessage(ev({ action: 'loudness', loudness: { nadie: 9 } }), sources), null);
  assert.equal(loudnessFromMessage(ev({ action: 'loudness', loudness: { sala1: 'x' } }), sources), null);
  assert.equal(loudnessFromMessage(ev({ action: 'loudness' }), sources), null);
  assert.equal(loudnessFromMessage(ev(null), sources), null);
  assert.equal(loudnessFromMessage({ origin: 'https://vdo.ninja' }, sources), null);
});

test('levelPct pasa el nivel de VDO.Ninja (0..~60) a 0..1 y no se sale', () => {
  assert.equal(levelPct(0), 0);
  assert.equal(levelPct(-5), 0);
  assert.equal(levelPct(1000), 1);
  assert.ok(levelPct(30) > levelPct(10));
  assert.ok(levelPct(30) > 0.4 && levelPct(30) < 0.9);
  assert.equal(levelPct(NaN), 0);
});

test('stepMeter sube al instante, baja despacio y el pico se mantiene un momento', () => {
  let m = newMeter();
  m = stepMeter(m, 0.8, 16);
  assert.equal(m.pct, 0.8);
  assert.equal(m.peak, 0.8);
  m = stepMeter(m, 0, 100);
  assert.ok(m.pct < 0.8 && m.pct > 0.3, `cae gradual: ${m.pct}`);
  assert.equal(m.peak, 0.8); // el pico aguanta
  for (let i = 0; i < 40; i++) m = stepMeter(m, 0, 100);
  assert.equal(m.pct, 0);
  assert.equal(m.peak, 0); // y al final también baja
});

test('SEGMENTS es el número de pasos del medidor', () => {
  assert.ok(Number.isInteger(SEGMENTS) && SEGMENTS >= 8);
});

test('rmsPct pasa el RMS de un analizador (0..1) a 0..1 en dB: -54 dBFS o menos = vacío, 0 dBFS = lleno', () => {
  assert.equal(rmsPct(0), 0);
  assert.equal(rmsPct(0.0001), 0);
  assert.equal(rmsPct(1), 1);
  assert.equal(rmsPct(5), 1);
  assert.ok(rmsPct(0.1) > 0.55 && rmsPct(0.1) < 0.7);
  assert.equal(rmsPct(NaN), 0);
});
