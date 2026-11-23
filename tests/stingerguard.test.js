import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, reduce } from '../server/state.js';
import { createStingerGuard } from '../server/stingerguard.js';

const team = (i) => ({ name: `Equipo ${i}`, players: ['a', 'b'], source: { kind: 'vdo', room: `r${i}` } });
const config = { teams: Array.from({ length: 8 }, (_, i) => team(i + 1)) };
const apply = (s, ...a) => a.reduce(reduce, s);
const armed = () => apply(createState(config), { type: 'VTR_FILES', files: ['@tabla', 'a.webm'] }, { type: 'STINGER_ADD', file: 'a.webm' }, { type: 'STINGER_CUT', file: 'a.webm', at: 5 });

function harness() {
  const timers = []; const actions = [];
  const guard = createStingerGuard({
    dispatch: (a) => actions.push(a),
    setTimer: (fn, ms) => { const t = { fn, ms, off: false }; timers.push(t); return t; },
    clearTimer: (t) => { t.off = true; },
  });
  return { guard, timers, actions, fire: (i) => { if (!timers[i].off) timers[i].fn(); } };
}

test('guard: al lanzar arma el seguro de corte (cutAt + 1,5 s) y el de fin (60 s)', () => {
  const h = harness();
  const base = armed();
  h.guard.check(base, apply(base, { type: 'STINGER_PLAY' }));
  assert.deepEqual(h.timers.map((t) => t.ms), [6500, 60000]);
  h.fire(0);
  assert.deepEqual(h.actions, [{ type: 'STINGER_CUT_NOW', seq: 1 }]);
  h.fire(1);
  assert.deepEqual(h.actions[1], { type: 'STINGER_END', seq: 1 });
});

test('guard: si /program ya cortó o terminó, los seguros se cancelan; un lanzamiento nuevo cancela los del anterior', () => {
  const h = harness();
  const base = armed();
  const run1 = apply(base, { type: 'STINGER_PLAY' });
  h.guard.check(base, run1);
  const cut = apply(run1, { type: 'STINGER_CUT_NOW', seq: 1 });
  h.guard.check(run1, cut);
  assert.equal(h.timers[0].off, true, 'el de corte se cancela al cortar');
  assert.equal(h.timers[1].off, false, 'el de fin sigue hasta que termine');
  const ended = apply(cut, { type: 'STINGER_END', seq: 1 });
  h.guard.check(cut, ended);
  assert.equal(h.timers[1].off, true);
  const h2 = harness();
  const r1 = apply(base, { type: 'STINGER_PLAY' });
  h2.guard.check(base, r1);
  const r2 = apply(r1, { type: 'STINGER_PLAY' });
  h2.guard.check(r1, r2);
  assert.deepEqual(h2.timers.map((t) => t.off), [true, true, false, false]);
  assert.equal(h2.timers.length, 4);
});

test('guard: stop() cancela todo; cambios que no tocan el run no arman nada', () => {
  const h = harness();
  const base = armed();
  h.guard.check(base, apply(base, { type: 'SET_PREVIEW', id: 'cam3' }));
  assert.equal(h.timers.length, 0);
  h.guard.check(base, apply(base, { type: 'STINGER_PLAY' }));
  h.guard.stop();
  assert.deepEqual(h.timers.map((t) => t.off), [true, true]);
});
