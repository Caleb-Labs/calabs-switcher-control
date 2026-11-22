// Medidores de audio sobre cada ventana del multiview (solo en /control; /program queda limpio).
// Cámaras: nivel que manda VDO.Ninja por postMessage. VTR: analizador de Web Audio sobre su <video>.
import { loudnessFromMessage, levelPct, rmsPct, stepMeter, newMeter } from '/shared/meter.js';

const STALE_MS = 1200; // sin lecturas por este tiempo el medidor cae a cero

export function initMeters() {
  const meters = new Map(); // id -> { el, off, peak, m, target, lastAt, shown }
  let raf = 0;
  let last = 0;
  let ctx = null;

  function build() {
    const el = document.createElement('div'); el.className = 'vu'; el.title = 'Nivel de audio de esta fuente';
    const off = document.createElement('i'); off.className = 'vu-off';
    const peak = document.createElement('i'); peak.className = 'vu-peak';
    el.append(off, peak);
    return { el, off, peak };
  }

  function attach(tile, id) {
    const parts = build();
    tile.append(parts.el);
    meters.set(id, { ...parts, m: newMeter(), target: 0, lastAt: 0, shown: [-1, -1] });
    start();
  }

  // Lectura de un analizador (VTR): rms 0..1.
  function setRms(id, rms) { const x = meters.get(id); if (x) { x.target = rmsPct(rms); x.lastAt = performance.now(); } }

  function onMessage(e, sources) {
    const r = loudnessFromMessage(e, sources);
    const x = r && meters.get(r.id);
    if (x) { x.target = levelPct(r.value); x.lastAt = performance.now(); }
  }

  // VTR: el <video> se deja sin silenciar pero conectado SOLO al analizador (no a los altavoces); si algo falla queda silenciado.
  function attachVideo(video, id) {
    if (video.dataset.metered || !meters.has(id)) return;
    try {
      ctx ??= new AudioContext();
      const src = ctx.createMediaElementSource(video); // desde aquí su audio ya no sale por los altavoces
      const an = ctx.createAnalyser(); an.fftSize = 1024;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      video.dataset.metered = '1'; video.muted = false; video.volume = 1;
      const resume = () => { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); };
      video.addEventListener('play', resume);
      window.addEventListener('pointerdown', resume, { once: true });
      const x = meters.get(id);
      x.poll = () => {
        if (video.paused || video.ended) { x.target = 0; return; }
        an.getFloatTimeDomainData(buf);
        let s = 0; for (const v of buf) s += v * v;
        setRms(id, Math.sqrt(s / buf.length));
      };
    } catch { video.muted = true; }
  }

  function frame(now) {
    const dt = Math.min(100, now - (last || now)); last = now;
    for (const x of meters.values()) {
      x.poll?.();
      const target = now - x.lastAt > STALE_MS ? 0 : x.target;
      x.m = stepMeter(x.m, target, dt);
      const p = Math.round(x.m.pct * 200) / 200; const k = Math.round(x.m.peak * 200) / 200;
      if (p !== x.shown[0]) { x.off.style.height = `${(1 - p) * 100}%`; x.shown[0] = p; }
      if (k !== x.shown[1]) { x.peak.style.bottom = `${k * 100}%`; x.peak.style.opacity = k > 0 ? '1' : '0'; x.shown[1] = k; }
    }
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  function reset() { meters.clear(); }

  return { attach, attachVideo, onMessage, reset };
}
