// Medidores de audio del multiview. VDO.Ninja manda por postMessage {action:'loudness', loudness:{<streamID>: nivel}}
// (el nivel va de 0 a ~60 con audio normal). Aquí solo hay lógica pura; el dibujo está en control/meters.js.
import { roomOf } from './signal.js';

export const SEGMENTS = 14;
const FULL = 60;       // nivel de VDO.Ninja que llena el medidor
const FALL = 2.4;      // caída del cuerpo: fracción del medidor por segundo
const PEAK_HOLD = 800; // ms que aguanta la marca de pico
const PEAK_FALL = 1;   // caída del pico después de aguantar (por segundo)

// Mensaje de nivel -> { id, value } de la cámara, o null si no es un nivel de una cámara conocida.
export function loudnessFromMessage(event, sources) {
  if (event?.origin !== 'https://vdo.ninja') return null;
  const d = event.data;
  if (!d || typeof d !== 'object' || d.action !== 'loudness' || !d.loudness || typeof d.loudness !== 'object') return null;
  for (const [streamID, value] of Object.entries(d.loudness)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const src = sources.find((s) => s.url && roomOf(s.url) === streamID);
    if (src) return { id: src.id, value };
  }
  return null;
}

// Nivel de VDO.Ninja -> 0..1 (curva suave para que lo bajo también se vea).
export function levelPct(v) {
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(1, v / FULL) ** 0.7;
}

// RMS de un analizador de Web Audio (0..1) -> 0..1 en dB, de -54 dBFS (vacío) a 0 dBFS (lleno). Para el VTR.
export function rmsPct(rms) {
  if (!Number.isFinite(rms) || rms <= 0) return 0;
  return Math.min(1, Math.max(0, (20 * Math.log10(rms) + 54) / 54));
}

export const newMeter = () => ({ pct: 0, peak: 0, peakAge: 0 });

// Un paso de animación: sube al instante, baja despacio; el pico aguanta y luego cae.
export function stepMeter(m, target, dtMs) {
  const dt = dtMs / 1000;
  const pct = target >= m.pct ? target : Math.max(target, m.pct - FALL * dt);
  if (pct >= m.peak) return { pct, peak: pct, peakAge: 0 };
  const peakAge = m.peakAge + dtMs;
  const peak = peakAge <= PEAK_HOLD ? m.peak : Math.max(pct, m.peak - PEAK_FALL * dt);
  return { pct, peak, peakAge };
}
