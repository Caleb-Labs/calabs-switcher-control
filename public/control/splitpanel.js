import { slotStyle, activeSlots, splitBgFile, moveRect, resizeRect } from '/shared/split.js';

const $ = (id) => document.getElementById(id);
const MEDIA = /\.(png|jpe?g|svg|mp4|webm|mov)$/i;

// Editor de la pantalla dividida: cantidad de cámaras, quién va en cada recuadro, posición/tamaño (arrastrar),
// fondo por cantidad y peleas guardadas.
export function initSplitPanel({ send }) {
  const canvas = $('sp-canvas');
  const lock = $('sp-lock');
  let state = null;
  let drag = null;
  let lastSend = 0;

  const blurOnChange = (el) => { el.addEventListener('change', () => el.blur()); }; // para que las teclas 1-9 sigan funcionando
  for (const id of ['sp-count', 'sp-bg', 'sp-fights']) blurOnChange($(id));

  $('sp-count').onchange = (e) => send({ type: 'SPLIT_SET_COUNT', count: Number(e.target.value) });
  $('sp-bg').onchange = (e) => send({ type: 'SPLIT_SET_BG', count: state.split.count, file: e.target.value || null });
  $('sp-reset').onclick = () => send({ type: 'SPLIT_RESET_LAYOUT' });
  $('sp-preview').onclick = () => send({ type: 'SET_PREVIEW', id: 'split' });
  const save = () => { const name = $('sp-name').value.trim(); if (name) { send({ type: 'SPLIT_SAVE_FIGHT', name }); $('sp-name').value = ''; } };
  $('sp-save').onclick = save;
  $('sp-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); save(); } });
  $('sp-load').onclick = () => { if ($('sp-fights').value) send({ type: 'SPLIT_LOAD_FIGHT', id: $('sp-fights').value }); };
  $('sp-delete').onclick = () => { if ($('sp-fights').value) send({ type: 'SPLIT_DELETE_FIGHT', id: $('sp-fights').value }); };

  const camOptions = () => state.sources.filter((s) => s.kind !== 'vtr' && s.kind !== 'split');

  function renderSlots() {
    const box = $('sp-slots');
    const slots = activeSlots(state);
    const cams = camOptions();
    const key = JSON.stringify([slots.length, cams.map((c) => c.id + c.label)]);
    if (box.dataset.key !== key) {
      box.dataset.key = key;
      box.replaceChildren(...slots.map((_, i) => {
        const row = document.createElement('label');
        row.append(`Recuadro ${i + 1} `);
        const sel = document.createElement('select');
        sel.dataset.index = i;
        sel.replaceChildren(...cams.map((c) => new Option(c.label, c.id)));
        sel.onchange = () => { send({ type: 'SPLIT_SET_CAM', index: i, cam: sel.value }); sel.blur(); };
        row.append(sel);
        return row;
      }));
    }
    box.querySelectorAll('select').forEach((sel, i) => { if (document.activeElement !== sel && slots[i]) sel.value = slots[i].cam; });
  }

  function applyBox(el, r) { Object.assign(el.style, slotStyle(r)); }

  function renderCanvas() {
    if (drag) return; // no reconstruir mientras se arrastra
    const labels = Object.fromEntries(state.sources.map((s) => [s.id, s.label]));
    const bg = splitBgFile(state);
    canvas.style.backgroundImage = bg && /\.(png|jpe?g|svg)$/i.test(bg) ? `url(/vtr/${encodeURIComponent(bg)})` : '';
    canvas.replaceChildren(...activeSlots(state).map((slot, i) => {
      const el = document.createElement('div');
      el.className = 'sp-box';
      el.dataset.index = i;
      applyBox(el, slot);
      const name = document.createElement('span'); name.textContent = `${i + 1} · ${labels[slot.cam] ?? slot.cam}`;
      const handle = document.createElement('div'); handle.className = 'sp-handle'; handle.title = 'Arrastra para cambiar el tamaño';
      el.append(name, handle);
      el.onpointerdown = (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        drag = { index: i, el, mode: e.target === handle ? 'resize' : 'move', x: e.clientX, y: e.clientY, rect: { ...activeSlots(state)[i] }, cur: null };
      };
      el.onpointermove = (e) => {
        if (!drag || drag.el !== el) return;
        const cr = canvas.getBoundingClientRect();
        const dx = (e.clientX - drag.x) / cr.width;
        const dy = (e.clientY - drag.y) / cr.height;
        drag.cur = drag.mode === 'move' ? moveRect(drag.rect, dx, dy) : resizeRect(drag.rect, dx, dy, lock.checked);
        applyBox(el, drag.cur);
        const now = Date.now();
        if (now - lastSend > 70) { lastSend = now; send({ type: 'SPLIT_SET_RECT', index: i, ...drag.cur }); } // /program sigue en vivo
      };
      const end = () => {
        if (!drag || drag.el !== el) return;
        if (drag.cur) send({ type: 'SPLIT_SET_RECT', index: i, ...drag.cur });
        drag = null;
        renderCanvas();
      };
      el.onpointerup = end;
      el.onpointercancel = end;
      return el;
    }));
  }

  function renderSelects() {
    const sp = state.split;
    $('sp-count').value = String(sp.count);
    const media = state.vtr.files.filter((f) => MEDIA.test(f));
    const bgKey = JSON.stringify(media);
    if ($('sp-bg').dataset.key !== bgKey) {
      $('sp-bg').dataset.key = bgKey;
      $('sp-bg').replaceChildren(new Option('(sin fondo)', ''), ...media.map((f) => new Option(f, f)));
    }
    $('sp-bg').value = sp.bgs[sp.count] ?? '';
    const fKey = JSON.stringify(sp.fights.map((f) => [f.id, f.name, f.count]));
    if ($('sp-fights').dataset.key !== fKey) {
      const keep = $('sp-fights').value;
      $('sp-fights').dataset.key = fKey;
      $('sp-fights').replaceChildren(...sp.fights.map((f) => new Option(`${f.name} (${f.count} cám.)`, f.id)));
      if (sp.fights.some((f) => f.id === keep)) $('sp-fights').value = keep;
    }
  }

  return {
    render(s) { state = s; renderSelects(); renderSlots(); renderCanvas(); },
  };
}
