// Cartel cuando el VTR no tiene archivo elegido: así nunca queda en negro sin explicación.
const NONE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#14161a"/><text x="960" y="520" text-anchor="middle" font-family="sans-serif" font-size="160" font-weight="700" fill="#6f8fb0">VTR</text><text x="960" y="620" text-anchor="middle" font-family="sans-serif" font-size="56" fill="#8a909b">sin archivo seleccionado</text></svg>';
const NONE_POSTER = `data:image/svg+xml;utf8,${encodeURIComponent(NONE_SVG)}`;
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
  if (plan.kind === 'image') el.setAttribute('poster', plan.url);
  else if (plan.kind === 'none') el.setAttribute('poster', NONE_POSTER);
  else el.removeAttribute('poster');
}

// Por qué suena (o no) el VTR: el audio sale por /program (OBS) solo si está al aire, en reproducción y sin silencio.
export function vtrAudioStatus(state) {
  const { current, playing } = state.vtr;
  if (!current) return { text: 'Sin archivo elegido', live: false };
  if (current === '@tabla' || IMAGE.has(ext(current))) return { text: 'Imagen: sin audio', live: false };
  if (!playing) return { text: 'En pausa: pulsa ▶ para que suene', live: false };
  const ch = state.audio?.vtr;
  if (ch && (ch.muted || ch.level === 0)) return { text: 'Silenciado (mute o nivel 0)', live: false };
  if (state.program !== 'vtr') return { text: 'Reproduciendo, pero NO está al aire: no se oye (pásalo a Program)', live: false };
  return { text: 'Sonando en Program', live: true };
}
