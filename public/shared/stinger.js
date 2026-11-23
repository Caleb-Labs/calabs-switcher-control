// Stinger (transición propia con punto de corte). Funciones puras, para cliente y servidor.

// Repara la lista leída del disco: [{file, cutAt}] sin duplicados; cutAt no válido o negativo vuelve a 0.
export function cleanStingers(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const x of raw) {
    if (x === null || typeof x !== 'object' || typeof x.file !== 'string' || !x.file || seen.has(x.file)) continue;
    seen.add(x.file);
    out.push({ file: x.file, cutAt: Number.isFinite(x.cutAt) && x.cutAt >= 0 ? x.cutAt : 0 });
  }
  return out;
}

// ¿Toca pedir el corte? Solo una vez, al llegar al segundo marcado.
export const shouldCut = ({ currentTime, cutAt, sent }) => !sent && currentTime >= cutAt;

// Transición elegida válida: la pedida si está en la lista; si no, la primera; si no hay, null.
export const pickSelected = (stingers, wanted) => (stingers.some((s) => s.file === wanted) ? wanted : stingers[0]?.file ?? null);
