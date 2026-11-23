import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, reduce, persistable } from '../server/state.js';
import { cleanStingers, shouldCut } from '../public/shared/stinger.js';

const team = (i) => ({ name: `Equipo ${i}`, players: [`J${i}A`, `J${i}B`], source: { kind: 'vdo', room: `r${i}` } });
const config = { teams: Array.from({ length: 8 }, (_, i) => team(i + 1)), aerial: { name: 'Aérea', source: { kind: 'vdo', room: 'a' } } };
const apply = (s, ...a) => a.reduce(reduce, s);
const withFiles = (extra = {}) => apply(createState({ ...config, ...extra }), { type: 'VTR_FILES', files: ['@tabla', 'a.webm', 'b.webm'] });

test('cleanStingers repara datos: negativo → 0, duplicados y basura fuera', () => {
  assert.deepEqual(cleanStingers(null), []);
  assert.deepEqual(cleanStingers('x'), []);
  assert.deepEqual(
    cleanStingers([{ file: 'a.webm', cutAt: -3 }, { file: 'a.webm', cutAt: 9 }, { file: 7, cutAt: 1 }, null, 'z', { file: 'b.webm', cutAt: 'x' }, { file: 'c.webm', cutAt: 5.25 }]),
    [{ file: 'a.webm', cutAt: 0 }, { file: 'b.webm', cutAt: 0 }, { file: 'c.webm', cutAt: 5.25 }],
  );
});

test('shouldCut: solo al llegar a cutAt y una sola vez', () => {
  assert.equal(shouldCut({ currentTime: 4.99, cutAt: 5, sent: false }), false);
  assert.equal(shouldCut({ currentTime: 5, cutAt: 5, sent: false }), true);
  assert.equal(shouldCut({ currentTime: 9, cutAt: 5, sent: true }), false);
});

test('STINGER_ADD solo registra archivos presentes; el primero queda elegido, con corte en 0', () => {
  const s0 = withFiles();
  assert.deepEqual(s0.stingers, []);
  assert.equal(s0.stingerSelected, null);
  assert.equal(apply(s0, { type: 'STINGER_ADD', file: 'no-existe.webm' }), s0);
  const s1 = apply(s0, { type: 'STINGER_ADD', file: 'a.webm' });
  assert.deepEqual(s1.stingers, [{ file: 'a.webm', cutAt: 0 }]);
  assert.equal(s1.stingerSelected, 'a.webm');
  const s2 = apply(s1, { type: 'STINGER_ADD', file: 'b.webm' });
  assert.equal(s2.stingers.length, 2);
  assert.equal(s2.stingerSelected, 'a.webm');
  assert.equal(apply(s2, { type: 'STINGER_ADD', file: 'b.webm' }), s2); // ya estaba
});

test('STINGER_CUT guarda el segundo (finito, ≥ 0) y rechaza lo demás', () => {
  const s = apply(withFiles(), { type: 'STINGER_ADD', file: 'a.webm' });
  assert.equal(apply(s, { type: 'STINGER_CUT', file: 'a.webm', at: 5.2 }).stingers[0].cutAt, 5.2);
  for (const at of [NaN, -1, '5', null, Infinity]) assert.equal(apply(s, { type: 'STINGER_CUT', file: 'a.webm', at }), s);
  assert.equal(apply(s, { type: 'STINGER_CUT', file: 'otra.webm', at: 3 }), s);
});

test('STINGER_SELECT y STINGER_REMOVE', () => {
  const s = apply(withFiles(), { type: 'STINGER_ADD', file: 'a.webm' }, { type: 'STINGER_ADD', file: 'b.webm' });
  assert.equal(apply(s, { type: 'STINGER_SELECT', file: 'b.webm' }).stingerSelected, 'b.webm');
  assert.equal(apply(s, { type: 'STINGER_SELECT', file: 'x.webm' }), s);
  const r = apply(s, { type: 'STINGER_REMOVE', file: 'a.webm' });
  assert.deepEqual(r.stingers.map((x) => x.file), ['b.webm']);
  assert.equal(r.stingerSelected, 'b.webm'); // si se quita la elegida, pasa a la siguiente
});

test('STINGER_PLAY: sin elegida o con Preview == Program no hace nada; si no, crea el run sin cambiar Program', () => {
  const none = withFiles();
  assert.equal(apply(none, { type: 'STINGER_PLAY' }), none);
  const ready = apply(none, { type: 'STINGER_ADD', file: 'a.webm' }, { type: 'STINGER_CUT', file: 'a.webm', at: 5 });
  const same = { ...ready, preview: ready.program };
  assert.equal(apply(same, { type: 'STINGER_PLAY' }), same);
  const run = apply(ready, { type: 'STINGER_PLAY' });
  assert.equal(run.program, ready.program);
  assert.deepEqual(run.stingerRun, { seq: 1, file: 'a.webm', cutAt: 5, from: ready.program, to: ready.preview, cut: false });
  assert.equal(apply(run, { type: 'STINGER_PLAY' }).stingerRun.seq, 2); // lanzar otra vez reinicia, no se bloquea
});

test('STINGER_CUT_NOW corta una sola vez (seq viejo o repetido se ignora) y STINGER_END limpia', () => {
  const run = apply(withFiles(), { type: 'STINGER_ADD', file: 'a.webm' }, { type: 'STINGER_PLAY' });
  const to = run.preview;
  assert.equal(apply(run, { type: 'STINGER_CUT_NOW', seq: 99 }), run);
  const cut = apply(run, { type: 'STINGER_CUT_NOW', seq: 1 });
  assert.equal(cut.program, to);
  assert.equal(cut.lastTake.mode, 'cut');
  assert.equal(cut.stingerRun.cut, true);
  assert.equal(apply(cut, { type: 'STINGER_CUT_NOW', seq: 1 }), cut);
  const re = apply(cut, { type: 'STINGER_PLAY' }); // otro lanzamiento: seq 2, vuelve a poder cortar
  assert.equal(re.stingerRun.seq, 2);
  assert.equal(apply(re, { type: 'STINGER_END', seq: 1 }), re);
  assert.equal(apply(re, { type: 'STINGER_END', seq: 2 }).stingerRun, null);
});

test('si se borra del disco el archivo de una transición, se quita de la lista y deja de estar elegida', () => {
  const s = apply(withFiles(), { type: 'STINGER_ADD', file: 'a.webm' }, { type: 'STINGER_ADD', file: 'b.webm' });
  const gone = apply(s, { type: 'VTR_FILES', files: ['@tabla', 'b.webm'] });
  assert.deepEqual(gone.stingers.map((x) => x.file), ['b.webm']);
  assert.equal(gone.stingerSelected, 'b.webm');
  const none = apply(gone, { type: 'VTR_FILES', files: ['@tabla'] });
  assert.deepEqual(none.stingers, []);
  assert.equal(none.stingerSelected, null);
});

test('persistencia: se guardan stingers y elegida; datos viejos sin esos campos cargan vacíos', () => {
  const s = apply(withFiles(), { type: 'STINGER_ADD', file: 'a.webm' }, { type: 'STINGER_CUT', file: 'a.webm', at: 4.5 });
  const p = persistable(s);
  assert.deepEqual(p.stingers, [{ file: 'a.webm', cutAt: 4.5 }]);
  assert.equal(p.stingerSelected, 'a.webm');
  const back = createState({ ...config, saved: { stingers: p.stingers, stingerSelected: p.stingerSelected } });
  assert.deepEqual(back.stingers, p.stingers);
  assert.equal(back.stingerSelected, 'a.webm');
  const old = createState({ ...config, saved: { gcPos: {} } });
  assert.deepEqual(old.stingers, []);
  assert.equal(old.stingerSelected, null);
  assert.equal(old.stingerSeq, 0);
  assert.equal(old.stingerRun, null);
});

test('si el operador ya cambió a mano durante el run, STINGER_CUT_NOW no devuelve la cámara', () => {
  const run = apply(withFiles(), { type: 'STINGER_ADD', file: 'a.webm' }, { type: 'STINGER_PLAY' });
  const manual = apply(run, { type: 'TAKE', mode: 'cut' }); // CUT a mano antes del segundo marcado: program = cam2
  assert.equal(manual.program, 'cam2');
  const after = apply(manual, { type: 'STINGER_CUT_NOW', seq: 1 });
  assert.equal(after.program, 'cam2', 'sigue en la cámara a la que ya se cortó');
  assert.equal(after.stingerRun.cut, true);
  assert.equal(apply(after, { type: 'STINGER_CUT_NOW', seq: 1 }), after);
});

test('si el Preview cambió durante el run, el corte va a la cámara con la que se lanzó (run.to)', () => {
  const run = apply(withFiles(), { type: 'STINGER_ADD', file: 'a.webm' }, { type: 'STINGER_PLAY' });
  const moved = apply(run, { type: 'SET_PREVIEW', id: 'cam5' });
  const cut = apply(moved, { type: 'STINGER_CUT_NOW', seq: 1 });
  assert.equal(cut.program, run.stingerRun.to);
  assert.equal(cut.preview, run.stingerRun.from);
});
