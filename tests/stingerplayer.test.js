import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStingerPlayer } from '../public/program/stinger.js';

const fakeVideo = () => ({ currentTime: 0, hidden: true, src: '', preload: '', plays: 0, pauses: 0, play() { this.plays++; }, pause() { this.pauses++; } });
const mk = () => { const video = fakeVideo(); const sent = []; return { video, sent, p: createStingerPlayer({ video, send: (a) => sent.push(a) }) }; };
const run = (o = {}) => ({ seq: 1, file: 'a b.webm', cutAt: 5, from: 'cam1', to: 'cam2', cut: false, ...o });

test('precarga oculta la transición elegida y cambia el video si cambia la elegida', () => {
  const { video, p } = mk();
  p.onState({ stingerSelected: 'a b.webm', stingerRun: null });
  assert.equal(video.src, '/vtr/a%20b.webm');
  assert.equal(video.preload, 'auto');
  assert.equal(video.hidden, true);
  assert.equal(video.plays, 0);
  p.onState({ stingerSelected: 'b.webm', stingerRun: null });
  assert.equal(video.src, '/vtr/b.webm');
});

test('un lanzamiento nuevo reinicia el video, lo muestra y lo reproduce; el mismo seq repetido no lo reinicia', () => {
  const { video, p } = mk();
  p.onState({ stingerSelected: 'a b.webm', stingerRun: null });
  video.currentTime = 3;
  p.onState({ stingerSelected: 'a b.webm', stingerRun: run() });
  assert.equal(video.currentTime, 0);
  assert.equal(video.hidden, false);
  assert.equal(video.plays, 1);
  video.currentTime = 2;
  p.onState({ stingerSelected: 'a b.webm', stingerRun: run() });
  assert.equal(video.currentTime, 2);
  assert.equal(video.plays, 1);
  p.onState({ stingerSelected: 'a b.webm', stingerRun: run({ seq: 2 }) }); // lanzar otra vez reinicia
  assert.equal(video.currentTime, 0);
  assert.equal(video.plays, 2);
});

test('el lanzamiento usa el archivo del run aunque la elegida haya cambiado', () => {
  const { video, p } = mk();
  p.onState({ stingerSelected: 'otra.webm', stingerRun: run({ file: 'a b.webm' }) });
  assert.equal(video.src, '/vtr/a%20b.webm');
});

test('onFrame pide el corte una sola vez, al llegar a cutAt', () => {
  const { video, sent, p } = mk();
  p.onState({ stingerSelected: 'a b.webm', stingerRun: run() });
  video.currentTime = 4.9; p.onFrame();
  assert.deepEqual(sent, []);
  video.currentTime = 5.02; p.onFrame(); p.onFrame(); video.currentTime = 7; p.onFrame();
  assert.deepEqual(sent, [{ type: 'STINGER_CUT_NOW', seq: 1 }]);
});

test('si el servidor ya cortó (seguro), no se pide otra vez', () => {
  const { video, sent, p } = mk();
  p.onState({ stingerSelected: 'a b.webm', stingerRun: run() });
  p.onState({ stingerSelected: 'a b.webm', stingerRun: run({ cut: true }) });
  video.currentTime = 6; p.onFrame();
  assert.deepEqual(sent, []);
});

test('onEnded sin corte previo (cutAt mayor que el video) corta primero y luego termina; oculta el video', () => {
  const { video, sent, p } = mk();
  p.onState({ stingerSelected: 'a b.webm', stingerRun: run({ cutAt: 99 }) });
  p.onEnded();
  assert.deepEqual(sent, [{ type: 'STINGER_CUT_NOW', seq: 1 }, { type: 'STINGER_END', seq: 1 }]);
  assert.equal(video.hidden, true);
  p.onEnded(); // doble aviso del navegador: no repite
  assert.equal(sent.length, 2);
});

test('onEnded tras haber cortado solo envía el fin; si el servidor limpia el run, se oculta y se pausa', () => {
  const { video, sent, p } = mk();
  p.onState({ stingerSelected: 'a b.webm', stingerRun: run() });
  video.currentTime = 5; p.onFrame();
  p.onEnded();
  assert.deepEqual(sent.map((a) => a.type), ['STINGER_CUT_NOW', 'STINGER_END']);
  const t = mk();
  t.p.onState({ stingerSelected: 'a b.webm', stingerRun: run() });
  t.p.onState({ stingerSelected: 'a b.webm', stingerRun: null });
  assert.equal(t.video.hidden, true);
  assert.equal(t.video.pauses, 1);
});

test('sin run y sin elegida no hace nada ni falla', () => {
  const { video, sent, p } = mk();
  p.onState({ stingerSelected: null, stingerRun: null });
  p.onFrame(); p.onEnded();
  assert.deepEqual(sent, []);
  assert.equal(video.hidden, true);
});

test('tras reiniciar el servidor (el seq vuelve a empezar), el primer lanzamiento sí se reproduce aunque repita el seq anterior', () => {
  const { video, p } = mk();
  p.onState({ stingerSelected: 'a b.webm', stingerRun: run() });
  p.onEnded();
  p.onState({ stingerSelected: 'a b.webm', stingerRun: null }); // el servidor limpió el run (o se reinició)
  p.onState({ stingerSelected: 'a b.webm', stingerRun: run() }); // seq 1 otra vez
  assert.equal(video.plays, 2);
  assert.equal(video.hidden, false);
});
