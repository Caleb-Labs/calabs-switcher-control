// Mover los GC principales (nombre y marcador) arrastrándolos en un lienzo 16:9. Se guarda y se aplica en vivo.
const DEFAULTS = {
  name: { x: 80 / 1920, y: (1080 - 90 - 120) / 1080, w: 620 / 1920, h: 120 / 1080, label: 'GC nombre' },
  score: { x: 60 / 1920, y: 60 / 1080, w: 520 / 1920, h: 0.3, label: 'Marcador' },
};

export function initGcMove({ send }) {
  const canvas = document.getElementById('gc-canvas');
  const boxes = {};
  let drag = null;
  let lastSend = 0;

  for (const [id, d] of Object.entries(DEFAULTS)) {
    const el = document.createElement('div');
    el.className = `gc-box gc-${id}`;
    el.textContent = d.label;
    el.style.width = `${d.w * 100}%`;
    el.style.height = `${d.h * 100}%`;
    el.onpointerdown = (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const cr = canvas.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      drag = { id, el, ox: e.clientX - r.left, oy: e.clientY - r.top, cr };
    };
    el.onpointermove = (e) => {
      if (!drag || drag.el !== el) return;
      const x = Math.min(0.95, Math.max(0, (e.clientX - drag.ox - drag.cr.left) / drag.cr.width));
      const y = Math.min(0.95, Math.max(0, (e.clientY - drag.oy - drag.cr.top) / drag.cr.height));
      el.style.left = `${x * 100}%`; el.style.top = `${y * 100}%`;
      drag.cur = { x, y };
      const now = Date.now();
      if (now - lastSend > 70) { lastSend = now; send({ type: 'GC_SET_POS', gcId: id, x, y }); }
    };
    const end = () => {
      if (!drag || drag.el !== el) return;
      if (drag.cur) send({ type: 'GC_SET_POS', gcId: id, ...drag.cur });
      drag = null;
    };
    el.onpointerup = end;
    el.onpointercancel = end;
    canvas.append(el);
    boxes[id] = el;
  }
  for (const [id, btn] of [['name', 'gc-reset-name'], ['score', 'gc-reset-score']]) {
    document.getElementById(btn).onclick = () => send({ type: 'GC_RESET_POS', gcId: id });
  }

  return {
    render(state) {
      if (drag) return;
      for (const [id, d] of Object.entries(DEFAULTS)) {
        const p = state.gcPos[id] ?? d;
        boxes[id].style.left = `${p.x * 100}%`;
        boxes[id].style.top = `${p.y * 100}%`;
        boxes[id].classList.toggle('custom', !!state.gcPos[id]);
      }
    },
  };
}
