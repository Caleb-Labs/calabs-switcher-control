import { slotStyle, activeSlots, splitBgFile } from '../shared/split.js';

// Vista de la pantalla dividida (para los tiles de /control): fondo + recuadros con el nombre de cada cámara.
// Con `videos` ({camId: url}) cada cámara muestra además su video real dentro de su recuadro (una conexión extra por cámara,
// por eso el panel solo lo pide mientras la dividida está en Preview o Program).
export function renderSplitView(el, state, videos = null) {
  const labels = Object.fromEntries(state.sources.map((s) => [s.id, s.label]));
  const status = Object.fromEntries(state.sources.map((s) => [s.id, s.status]));
  const bg = splitBgFile(state);
  const slots = activeSlots(state);
  const seen = new Set();
  const feeds = [];
  if (videos) for (const slot of slots) {
    if (seen.has(slot.cam)) continue;
    seen.add(slot.cam);
    if (videos[slot.cam] && status[slot.cam] !== 'nosignal') feeds.push({ cam: slot.cam, url: videos[slot.cam], slot });
  }
  const key = JSON.stringify([slots, bg, slots.map((s) => labels[s.cam]), feeds.map((f) => [f.cam, f.url])]);
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.replaceChildren();
  el.style.backgroundImage = bg && /\.(png|jpe?g|svg)$/i.test(bg) ? `url(/vtr/${encodeURIComponent(bg)})` : '';
  for (const f of feeds) {
    const v = document.createElement('iframe');
    v.className = 'sv-video';
    v.dataset.cam = f.cam;
    v.setAttribute('allow', 'autoplay');
    v.setAttribute('src', f.url);
    Object.assign(v.style, slotStyle(f.slot));
    el.append(v);
  }
  for (const slot of slots) {
    const b = document.createElement('div');
    b.className = feeds.some((f) => f.cam === slot.cam) ? 'sv-box has-video' : 'sv-box';
    Object.assign(b.style, slotStyle(slot));
    b.textContent = labels[slot.cam] ?? slot.cam;
    el.append(b);
  }
}
