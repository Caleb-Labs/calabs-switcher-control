import { slotStyle, activeSlots, splitBgFile } from '/shared/split.js';

// Vista esquemática de la pantalla dividida (para los tiles de /control): fondo + recuadros con el nombre de cada cámara.
export function renderSplitView(el, state) {
  const labels = Object.fromEntries(state.sources.map((s) => [s.id, s.label]));
  const bg = splitBgFile(state);
  const slots = activeSlots(state);
  const key = JSON.stringify([slots, bg, slots.map((s) => labels[s.cam])]);
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.replaceChildren();
  el.style.backgroundImage = bg && /\.(png|jpe?g|svg)$/i.test(bg) ? `url(/vtr/${encodeURIComponent(bg)})` : '';
  for (const slot of slots) {
    const b = document.createElement('div');
    b.className = 'sv-box';
    Object.assign(b.style, slotStyle(slot));
    b.textContent = labels[slot.cam] ?? slot.cam;
    el.append(b);
  }
}
