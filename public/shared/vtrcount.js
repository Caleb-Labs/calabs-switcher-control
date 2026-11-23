// Contador del VTR: "-02:28 / 03:10" (lo que falta / total). Usa el mismo reloj que las demás pantallas
// (vtrPosition), así que marca lo mismo que se ve en /program (OBS). Con el VTR en pausa se queda quieto.
import { vtrPlan, vtrPosition } from './vtr.js';

export const WARN_SECONDS = 10; // en los últimos segundos el contador avisa (parpadea en rojo)

export function fmtClock(sec) {
  const s = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

// -> { text, warn, paused } o null si no hay video con duración conocida (imagen, tabla, sin archivo, metadatos sin cargar).
export function vtrCounter(vtr, duration, now = Date.now()) {
  if (vtrPlan(vtr).kind !== 'video') return null;
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const pos = Math.min(duration, vtrPosition(vtr, now));
  const remaining = Math.max(0, Math.ceil(duration - pos)); // hacia arriba: llega a 00:00 justo al terminar
  return {
    text: `-${fmtClock(remaining)} / ${fmtClock(Math.round(duration))}`,
    warn: remaining <= WARN_SECONDS,
    paused: !vtr.playing,
  };
}
