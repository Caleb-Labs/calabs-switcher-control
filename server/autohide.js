// Baja solos los GC después de N segundos (según el estilo de cada tipo). 0 = manual.
const KEYS = ['name', 'score', 'split'];
const visible = (s) => ({
  name: s.gc?.name?.state === 'live',
  score: s.gc?.score?.state === 'live',
  split: s.splitGc === 'live' && s.program === 'split', // los de la dividida cuentan desde que se ven
});
const defaultSetTimer = (fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return t; };

export function createAutoHide({ dispatch, setTimer = defaultSetTimer, clearTimer = clearTimeout }) {
  const timers = {};
  const fire = (k) => {
    delete timers[k];
    dispatch(k === 'split' ? { type: 'SPLIT_GC', to: 'off' } : { type: 'GC_OFF', gcId: k });
  };
  return {
    check(prev, next) {
      const was = visible(prev);
      const is = visible(next);
      for (const k of KEYS) {
        if (!was[k] && is[k]) {
          const secs = next.gcStyle?.[k]?.autoHide ?? 0;
          if (secs > 0) timers[k] = setTimer(() => fire(k), secs * 1000);
        } else if (was[k] && !is[k] && timers[k]) {
          clearTimer(timers[k]);
          delete timers[k];
        }
      }
    },
    stop() { for (const k of Object.keys(timers)) { clearTimer(timers[k]); delete timers[k]; } },
  };
}
