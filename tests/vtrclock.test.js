import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, reduce } from '../server/state.js';
import { vtrPosition, syncVtr } from '../public/shared/vtr.js';

const team = (i) => ({ name: `E${i}`, players: ['a', 'b'], source: { kind: 'vdo', room: `r${i}` } });
const S = () => createState({ teams: Array.from({ length: 8 }, (_, i) => team(i + 1)) });
const apply = (s, ...a) => a.reduce(reduce, s);
const base = () => apply(S(), { type: 'VTR_FILES', files: ['a.mp4', 'b.mp4'] }, { type: 'VTR_SELECT', file: 'a.mp4' });

test('el reloj del VTR parte en pos 0 sin reproducir', () => {
  const s = base();
  assert.equal(s.vtr.pos, 0);
  assert.equal(s.vtr.since, null);
  assert.equal(vtrPosition(s.vtr, 5000), 0);
});

test('VTR_PLAY guarda la hora de arranque y la posición avanza con el tiempo', () => {
  const s = apply(base(), { type: 'VTR_PLAY', now: 1000 });
  assert.equal(s.vtr.playing, true);
  assert.equal(s.vtr.since, 1000);
  assert.equal(vtrPosition(s.vtr, 1000), 0);
  assert.equal(vtrPosition(s.vtr, 6500), 5.5);
});

test('VTR_PAUSE congela la posición; otro VTR_PLAY continúa desde ahí', () => {
  let s = apply(base(), { type: 'VTR_PLAY', now: 1000 }, { type: 'VTR_PAUSE', now: 11000 });
  assert.equal(s.vtr.playing, false);
  assert.equal(s.vtr.pos, 10);
  assert.equal(s.vtr.since, null);
  assert.equal(vtrPosition(s.vtr, 99999), 10);
  s = apply(s, { type: 'VTR_PLAY', now: 20000 });
  assert.equal(vtrPosition(s.vtr, 23000), 13);
});

test('VTR_PLAY con el VTR ya reproduciendo no reinicia el reloj', () => {
  const s = apply(base(), { type: 'VTR_PLAY', now: 1000 });
  assert.equal(apply(s, { type: 'VTR_PLAY', now: 5000 }), s);
});

test('VTR_TOGGLE alterna conservando la posición', () => {
  let s = apply(base(), { type: 'VTR_TOGGLE', now: 1000 });
  assert.equal(s.vtr.playing, true);
  s = apply(s, { type: 'VTR_TOGGLE', now: 4000 });
  assert.equal(s.vtr.playing, false);
  assert.equal(s.vtr.pos, 3);
});

test('cambiar de archivo (elegir, siguiente, anterior) vuelve a 0; si estaba reproduciendo, arranca de nuevo', () => {
  const playing = apply(base(), { type: 'VTR_PLAY', now: 1000 });
  for (const a of [{ type: 'VTR_SELECT', file: 'b.mp4' }, { type: 'VTR_NEXT' }, { type: 'VTR_PREV' }]) {
    const s = apply(playing, { ...a, now: 9000 });
    assert.equal(s.vtr.pos, 0, a.type);
    assert.equal(s.vtr.since, 9000, a.type);
    assert.equal(s.vtr.playing, true, a.type);
  }
  const paused = apply(base(), { type: 'VTR_PLAY', now: 1000 }, { type: 'VTR_PAUSE', now: 5000 }, { type: 'VTR_NEXT', now: 6000 });
  assert.equal(paused.vtr.pos, 0);
  assert.equal(paused.vtr.since, null);
});

test('VTR_ENDED detiene y vuelve a 0', () => {
  const s = apply(base(), { type: 'VTR_PLAY', now: 1000 }, { type: 'VTR_ENDED' });
  assert.equal(s.vtr.playing, false);
  assert.equal(s.vtr.pos, 0);
  assert.equal(s.vtr.since, null);
  const idle = base();
  assert.equal(apply(idle, { type: 'VTR_ENDED' }), idle);
});

test('si el archivo desaparece de la lista, el reloj se reinicia', () => {
  const s = apply(base(), { type: 'VTR_PLAY', now: 1000 }, { type: 'VTR_FILES', files: ['z.mp4'] });
  assert.equal(s.vtr.playing, false);
  assert.equal(s.vtr.pos, 0);
  assert.equal(s.vtr.since, null);
});

// --- syncVtr: cada pantalla salta al punto del reloj solo si se desvió
const vid = (currentTime, { duration = 100 } = {}) => {
  const el = { currentTime, duration, paused: true, src: null, attrs: {}, plays: 0, pauses: 0 };
  el.getAttribute = (k) => el.attrs[k] ?? null;
  el.setAttribute = (k, v) => { el.attrs[k] = v; };
  el.removeAttribute = (k) => { delete el.attrs[k]; };
  el.hasAttribute = (k) => k in el.attrs;
  el.play = () => { el.plays++; el.paused = false; return Promise.resolve(); };
  el.pause = () => { el.pauses++; el.paused = true; };
  return el;
};
const playingAt = (since, pos = 0) => ({ files: ['a.mp4'], current: 'a.mp4', playing: true, pos, since });

test('syncVtr: si el video va casi en hora no lo toca; si se desvió más de ~0.35 s salta al punto del reloj', () => {
  const near = vid(10.2); syncVtr(near, playingAt(0), 10000);
  assert.equal(near.currentTime, 10.2);
  const far = vid(3); syncVtr(far, playingAt(0), 10000);
  assert.equal(far.currentTime, 10);
  assert.equal(far.plays, 1);
});

test('syncVtr: en pausa deja el video en la posición congelada', () => {
  const el = vid(7); el.paused = false;
  syncVtr(el, { files: ['a.mp4'], current: 'a.mp4', playing: false, pos: 4, since: null }, 99999);
  assert.equal(el.currentTime, 4);
  assert.equal(el.pauses, 1);
});

test('syncVtr: no pasa del final del video', () => {
  const el = vid(1, { duration: 20 }); syncVtr(el, playingAt(0), 50000);
  assert.equal(el.currentTime, 20);
});

test('syncVtr: una imagen o la tabla no usan el reloj', () => {
  const el = vid(5); syncVtr(el, { files: ['a.png'], current: 'a.png', playing: true, pos: 0, since: 0 }, 9000);
  assert.equal(el.currentTime, 5);
});
