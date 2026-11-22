const IMAGE = new Set(['.png', '.jpg', '.svg']);
const ext = (n) => { const i = n.lastIndexOf('.'); return i < 0 ? '' : n.slice(i).toLowerCase(); };

// Qué debe mostrar el VTR según el estado. Las imágenes van como "poster" del <video>.
export function vtrPlan({ current, playing }) {
  if (!current) return { kind: 'none', url: null, play: false };
  if (current === '@tabla') return { kind: 'standings', url: null, play: false };
  const url = `/vtr/${encodeURIComponent(current)}`;
  if (IMAGE.has(ext(current))) return { kind: 'image', url, play: false };
  return { kind: 'video', url, play: !!playing };
}

export function syncVtr(el, vtr) {
  const plan = vtrPlan(vtr);
  if (plan.kind === 'video') {
    el.removeAttribute('poster');
    if (el.getAttribute('src') !== plan.url) el.setAttribute('src', plan.url);
    if (plan.play) el.play?.().catch(() => {}); else el.pause?.();
    return;
  }
  if (el.hasAttribute('src')) { el.removeAttribute('src'); el.load?.(); }
  if (plan.kind === 'image') el.setAttribute('poster', plan.url); else el.removeAttribute('poster');
}
