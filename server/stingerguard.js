// Seguro del stinger: si /program no responde, el servidor corta solo (cutAt + graceMs) y limpia el lanzamiento (maxMs).
const defaultSetTimer = (fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return t; };

export function createStingerGuard({ dispatch, setTimer = defaultSetTimer, clearTimer = clearTimeout, graceMs = 1500, maxMs = 60000 }) {
  let seq = 0;
  let cutTimer = null;
  let endTimer = null;
  const cancelCut = () => { if (cutTimer) { clearTimer(cutTimer); cutTimer = null; } };
  const cancelEnd = () => { if (endTimer) { clearTimer(endTimer); endTimer = null; } };
  return {
    check(prev, next) {
      const run = next.stingerRun;
      if (!run) { cancelCut(); cancelEnd(); seq = 0; return; }
      if (run.seq !== seq) { // lanzamiento nuevo: reemplaza a los seguros del anterior
        cancelCut(); cancelEnd();
        seq = run.seq;
        cutTimer = setTimer(() => { cutTimer = null; dispatch({ type: 'STINGER_CUT_NOW', seq: run.seq }); }, run.cutAt * 1000 + graceMs);
        endTimer = setTimer(() => { endTimer = null; dispatch({ type: 'STINGER_END', seq: run.seq }); }, maxMs);
        return;
      }
      if (run.cut) cancelCut(); // ya cortó (/program o el propio seguro)
    },
    stop() { cancelCut(); cancelEnd(); },
  };
}
