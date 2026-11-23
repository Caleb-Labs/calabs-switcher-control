import { shouldCut } from '../shared/stinger.js';

// Reproductor del stinger en /program. Precarga la transición elegida (oculta); al aparecer un lanzamiento nuevo la reproduce
// y, al llegar al segundo marcado, pide el corte (una sola vez). El video lleva su audio: sale por /program como el VTR.
export function createStingerPlayer({ video, send }) {
  let loaded = null;   // archivo cargado en el <video>
  let lastSeq = 0;     // último lanzamiento visto
  let current = null;  // { seq, cutAt } mientras se reproduce
  let sent = false;    // ¿ya se pidió el corte de este lanzamiento?
  const load = (file) => {
    if (!file || file === loaded) return;
    loaded = file;
    video.preload = 'auto';
    video.src = `/vtr/${encodeURIComponent(file)}`;
  };
  const stop = () => { current = null; video.hidden = true; video.pause?.(); };
  return {
    onState(state) {
      const run = state.stingerRun;
      if (run && run.seq !== lastSeq) {
        lastSeq = run.seq;
        load(run.file);
        current = { seq: run.seq, cutAt: run.cutAt };
        sent = !!run.cut;
        video.currentTime = 0;
        video.hidden = false;
        Promise.resolve(video.play()).catch(() => {});
      } else if (run && current && run.cut) sent = true; // el servidor ya cortó (seguro): no se pide otra vez
      else if (!run && current) stop();                  // el servidor limpió el lanzamiento
      if (!run) lastSeq = 0; // sin lanzamiento en curso: si el servidor se reinició, su seq vuelve a empezar y no debe confundirse con el último visto
      if (!current) load(state.stingerSelected);
    },
    onFrame() {
      if (!current || !shouldCut({ currentTime: video.currentTime, cutAt: current.cutAt, sent })) return;
      sent = true;
      send({ type: 'STINGER_CUT_NOW', seq: current.seq });
    },
    onEnded() {
      if (!current) return;
      const { seq } = current;
      if (!sent) send({ type: 'STINGER_CUT_NOW', seq });
      send({ type: 'STINGER_END', seq });
      current = null;
      video.hidden = true;
    },
  };
}
