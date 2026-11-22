import { syncGraphics, applyScale } from '/graphics/layer.js';
import { IN_EFFECTS, OUT_EFFECTS } from '/shared/gcstyle.js';
import { uploadFile } from './upload.js';
import { downloadGcMold } from './mold.js';

const $ = (id) => document.getElementById(id);
const IN_LABELS = { none: 'Ninguno', fade: 'Aparecer', 'slide-left': 'Deslizar desde la izquierda', 'slide-right': 'Deslizar desde la derecha', 'slide-up': 'Subir desde abajo', zoom: 'Zoom', typewriter: 'Máquina de escribir' };
const OUT_LABELS = { none: 'Ninguno', fade: 'Desvanecer', 'slide-left': 'Salir a la izquierda', 'slide-right': 'Salir a la derecha', 'slide-down': 'Bajar', zoom: 'Zoom' };
const IMG = /\.(png|jpe?g|svg)$/i;

// Estilo de los GC: colores, tamaño, plantilla subida, efectos de entrada/salida y salida automática. Vista previa en vivo.
export function initGcStylePanel({ send }) {
  let state = null;
  const stage = $('gs-stage');
  const target = () => $('gs-target').value;
  const style = () => state.gcStyle[target()];
  let t = 0;
  const patch = (p, { throttle = false } = {}) => {
    if (throttle) { const now = Date.now(); if (now - t < 80) return; t = now; }
    send({ type: 'GC_STYLE', target: target(), patch: p });
  };

  $('gs-in').replaceChildren(...IN_EFFECTS.map((k) => new Option(IN_LABELS[k], k)));
  $('gs-out').replaceChildren(...OUT_EFFECTS.map((k) => new Option(OUT_LABELS[k], k)));
  $('gs-target').onchange = () => { $('gs-target').blur(); render(state); replay(); };
  for (const [id, key] of [['gs-bg', 'bg'], ['gs-text', 'text'], ['gs-sub', 'sub'], ['gs-accent', 'accent']]) {
    $(id).oninput = () => patch({ [key]: $(id).value }, { throttle: true });
    $(id).onchange = () => patch({ [key]: $(id).value });
  }
  $('gs-alpha').oninput = () => patch({ bgAlpha: Number($('gs-alpha').value) / 100 }, { throttle: true });
  $('gs-alpha').onchange = () => { patch({ bgAlpha: Number($('gs-alpha').value) / 100 }); $('gs-alpha').blur(); };
  $('gs-scale').oninput = () => patch({ scale: Number($('gs-scale').value) / 100 }, { throttle: true });
  $('gs-scale').onchange = () => { patch({ scale: Number($('gs-scale').value) / 100 }); $('gs-scale').blur(); };
  $('gs-in').onchange = () => { patch({ effectIn: $('gs-in').value }); $('gs-in').blur(); setTimeout(replay, 150); };
  $('gs-out').onchange = () => { patch({ effectOut: $('gs-out').value }); $('gs-out').blur(); };
  $('gs-hide').onchange = () => { patch({ autoHide: Math.max(0, Math.min(600, Math.round(Number($('gs-hide').value) || 0))) }); };
  $('gs-tpl').onchange = () => { patch({ template: $('gs-tpl').value || null }); $('gs-tpl').blur(); };
  $('gs-tpl-clear').onclick = () => patch({ template: null });
  $('gs-tpl-mold').onclick = downloadGcMold;
  $('gs-tpl-up').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { patch({ template: await uploadFile(f) }); } catch (err) { alert(`No se pudo subir: ${err.message}`); }
  };
  $('gs-replay').onclick = () => replay();

  // Vista previa: el mismo dibujante que usa /program, con un estado de ejemplo.
  function fake() {
    const tg = target();
    const gcStyle = { ...state.gcStyle, name: tg === 'split' ? state.gcStyle.split : state.gcStyle.name };
    const sample = { team: tg === 'score' ? '' : 'Título de ejemplo', player: 'Subtítulo de ejemplo' };
    return {
      gc: tg === 'score' ? { score: { template: 'scoreboard', data: {}, state: 'live' } } : { name: { template: 'gc-name', data: sample, state: 'live' } },
      gcStyle, gcPos: { name: { x: 0.05, y: 0.55 }, score: { x: 0.05, y: 0.06 } },
      scoreboard: { teams: [{ name: 'Piratas', points: 12, position: 1 }, { name: 'Kraken', points: 9, position: 2 }, { name: 'Sirenas', points: 4, position: 3 }] },
      vtr: { current: null }, program: 'cam1', preview: 'cam2', emergency: false, splitGc: 'off', split: state.split,
    };
  }
  function draw() {
    stage.style.width = '1920px';
    try { syncGraphics(stage, fake(), 'live'); } catch (e) { console.error('vista previa:', e); }
    applyScale(stage);
  }
  function replay() { if (!state) return; stage.replaceChildren(); draw(); }
  new ResizeObserver(() => applyScale(stage)).observe($('gs-preview'));

  const setVal = (el, v) => { if (document.activeElement !== el) el.value = v; };
  function render(s) {
    state = s;
    const st = style();
    const isScore = target() === 'score';
    setVal($('gs-bg'), st.bg); setVal($('gs-text'), st.text); setVal($('gs-sub'), st.sub); setVal($('gs-accent'), st.accent);
    setVal($('gs-alpha'), Math.round(st.bgAlpha * 100)); setVal($('gs-scale'), Math.round(st.scale * 100));
    $('gs-scale-val').textContent = `${Math.round(st.scale * 100)} %`;
    $('gs-alpha-val').textContent = `${Math.round(st.bgAlpha * 100)} %`;
    setVal($('gs-in'), st.effectIn); setVal($('gs-out'), st.effectOut); setVal($('gs-hide'), st.autoHide);
    const media = s.vtr.files.filter((f) => IMG.test(f));
    const key = JSON.stringify(media);
    if ($('gs-tpl').dataset.key !== key) { $('gs-tpl').dataset.key = key; $('gs-tpl').replaceChildren(new Option('(sin plantilla)', ''), ...media.map((f) => new Option(f, f))); }
    setVal($('gs-tpl'), st.template ?? '');
    $('gs-tpl-box').hidden = isScore;
    draw();
  }
  return { render };
}
