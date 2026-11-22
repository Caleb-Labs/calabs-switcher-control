import { slotStyle, activeSlots, splitBgFile, moveRect, resizeRect, slotNames, toggleCam, slotPixels } from '/shared/split.js';
import { uploadFile } from './upload.js';
import { downloadMold } from './mold.js';

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
  blurOnChange($('sp-fights'));

  $('sp-reset').onclick = () => send({ type: 'SPLIT_RESET_LAYOUT' });
  $('sp-preview').onclick = () => send({ type: 'SET_PREVIEW', id: 'split' });
  const save = () => { const name = $('sp-name').value.trim(); if (name) { send({ type: 'SPLIT_SAVE_FIGHT', name }); $('sp-name').value = ''; } };
  $('sp-save').onclick = save;
  $('sp-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); save(); } });
  $('sp-load').onclick = () => { if ($('sp-fights').value) send({ type: 'SPLIT_LOAD_FIGHT', id: $('sp-fights').value }); };
  $('sp-delete').onclick = () => { if ($('sp-fights').value) send({ type: 'SPLIT_DELETE_FIGHT', id: $('sp-fights').value }); };

  const camOptions = () => state.sources.filter((s) => s.kind !== 'vtr' && s.kind !== 'split');

  function renderChips() {
    const cams = camOptions();
    const chosen = [...new Set(activeSlots(state).map((s) => s.cam))];
    const key = JSON.stringify([cams.map((c) => c.id + c.label), chosen]);
    const box = $('sp-chips');
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.replaceChildren(...cams.map((c) => {
      const order = chosen.indexOf(c.id);
      const b = document.createElement('button');
      b.className = `chip${order >= 0 ? ' on' : ''}`;
      b.textContent = c.label;
      if (order >= 0) { const n = document.createElement('b'); n.textContent = order + 1; b.append(n); }
      b.onclick = () => { send({ type: 'SPLIT_SET_CAMS', cams: toggleCam(chosen, c.id) }); b.blur(); };
      return b;
    }));
  }

  function renderSlots() {
    const box = $('sp-slots');
    const slots = activeSlots(state);
    const cams = camOptions();
    const names = slotNames(slots.length);
    const key = JSON.stringify([slots.length, cams.map((c) => c.id + c.label)]);
    if (box.dataset.key !== key) {
      box.dataset.key = key;
      box.replaceChildren(...slots.map((_, i) => {
        const row = document.createElement('label');
        row.append(`${i + 1} · ${names[i]}`);
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

  const isImage = (f) => /\.(png|jpe?g|svg)$/i.test(f);

  function renderCards() {
    const sp = state.split;
    const media = state.vtr.files.filter((f) => MEDIA.test(f));
    const key = JSON.stringify([sp.count, sp.layouts, sp.bgs, media]);
    const box = $('sp-cards');
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.replaceChildren(...Object.keys(sp.layouts).map((k) => {
      const n = Number(k);
      const slots = sp.layouts[n];
      const names = slotNames(n);
      const bg = sp.bgs[n] ?? '';
      const card = document.createElement('div');
      card.className = `card${n === sp.count ? ' active' : ''}`;

      const head = document.createElement('div'); head.className = 'card-head';
      const title = document.createElement('strong'); title.textContent = `${n} ${n === 1 ? 'cámara' : 'cámaras'}`;
      const use = document.createElement('button'); use.textContent = n === sp.count ? 'En edición' : 'Editar'; use.disabled = n === sp.count;
      use.onclick = () => send({ type: 'SPLIT_SET_COUNT', count: n });
      head.append(title, use);

      const thumb = document.createElement('div'); thumb.className = 'thumb';
      if (bg && isImage(bg)) thumb.style.backgroundImage = `url(/vtr/${encodeURIComponent(bg)})`;
      slots.forEach((s, i) => {
        const b = document.createElement('div'); b.className = 'tb'; Object.assign(b.style, slotStyle(s)); b.textContent = i + 1; thumb.append(b);
      });

      const sel = document.createElement('select');
      sel.replaceChildren(new Option('(sin fondo)', ''), ...media.map((f) => new Option(f, f)));
      sel.value = media.includes(bg) ? bg : '';
      sel.onchange = () => { send({ type: 'SPLIT_SET_BG', count: n, file: sel.value || null }); sel.blur(); };

      const actions = document.createElement('div'); actions.className = 'card-actions';
      const up = document.createElement('label'); up.className = 'btn'; up.textContent = 'Cargar fondo';
      const input = document.createElement('input'); input.type = 'file'; input.hidden = true; input.accept = '.png,.jpg,.jpeg,.svg,.mp4,.webm,.mov';
      input.onchange = async () => {
        const f = input.files[0]; if (!f) return;
        up.firstChild.textContent = 'Subiendo…';
        try { const name = await uploadFile(f); send({ type: 'SPLIT_SET_BG', count: n, file: name }); }
        catch (e) { alert(`No se pudo subir: ${e.message}`); }
        up.firstChild.textContent = 'Cargar fondo';
      };
      up.append(input);
      const mold = document.createElement('button'); mold.textContent = 'Molde PNG'; mold.title = 'Descarga la guía con los recuadros y sus medidas';
      mold.onclick = () => downloadMold(n, slots);
      actions.append(up, mold);

      const det = document.createElement('details');
      const sum = document.createElement('summary'); sum.textContent = 'Medidas (px, lienzo 1920×1080)';
      const ul = document.createElement('ul');
      slotPixels(slots).forEach((p, i) => { const li = document.createElement('li'); li.textContent = `${i + 1} · ${names[i]}: ${p.w} × ${p.h} px (X ${p.x}, Y ${p.y})`; ul.append(li); });
      det.append(sum, ul);

      card.append(head, thumb, sel, actions, det);
      return card;
    }));
  }

  function renderSelects() {
    const sp = state.split;
    const fKey = JSON.stringify(sp.fights.map((f) => [f.id, f.name, f.count]));
    if ($('sp-fights').dataset.key !== fKey) {
      const keep = $('sp-fights').value;
      $('sp-fights').dataset.key = fKey;
      $('sp-fights').replaceChildren(...sp.fights.map((f) => new Option(`${f.name} (${f.count} cám.)`, f.id)));
      if (sp.fights.some((f) => f.id === keep)) $('sp-fights').value = keep;
    }
  }

  return {
    render(s) { state = s; renderSelects(); renderChips(); renderSlots(); renderCanvas(); renderCards(); },
  };
}
