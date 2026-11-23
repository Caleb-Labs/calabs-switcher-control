import { uploadFile } from './upload.js';

const $ = (id) => document.getElementById(id);
const HELP = 'Aún no hay transiciones. Agrega un video WebM con transparencia (un .mp4 solo sirve si la transición no necesita transparencia).';

// Segundo actual del video para «Cortar aquí»: 2 decimales, nunca negativo ni NaN.
export const cutValue = (video) => (Number.isFinite(video.currentTime) && video.currentTime > 0 ? Math.round(video.currentTime * 100) / 100 : 0);

// Lista de transiciones: una fila por archivo (la elegida marcada). Los nombres van como texto, nunca como HTML.
export function renderStingerList(el, state) {
  const key = JSON.stringify([state.stingers, state.stingerSelected]);
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.replaceChildren();
  const doc = el.ownerDocument;
  if (!state.stingers.length) {
    const p = doc.createElement('span');
    p.className = 'hint';
    p.textContent = HELP;
    el.append(p);
    return;
  }
  for (const s of state.stingers) {
    const row = doc.createElement('div');
    row.className = s.file === state.stingerSelected ? 'st-row on' : 'st-row';
    const pick = doc.createElement('button');
    pick.dataset.act = 'select'; pick.dataset.file = s.file;
    pick.textContent = `${s.file} · corte en ${s.cutAt} s`;
    const del = doc.createElement('button');
    del.dataset.act = 'remove'; del.dataset.file = s.file;
    del.title = 'Quitar de la lista (el archivo se queda en la carpeta vtr)';
    del.textContent = '✕';
    row.append(pick, del);
    el.append(row);
  }
}

// Pestaña Mezclador: lista de transiciones + editor del punto de corte (video, barra, «Cortar aquí» y número editable).
export function initStingerPanel({ send }) {
  const list = $('st-list'), editor = $('st-editor'), video = $('st-video'), range = $('st-range'), num = $('st-num');
  let state = null;
  const sel = () => state?.stingerSelected ?? null;

  list.onclick = (e) => {
    const b = e.target.closest?.('[data-act]');
    if (!b) return;
    send({ type: b.dataset.act === 'remove' ? 'STINGER_REMOVE' : 'STINGER_SELECT', file: b.dataset.file });
  };
  $('st-add').onclick = () => $('st-file').click();
  $('st-file').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { send({ type: 'STINGER_ADD', file: await uploadFile(f) }); } catch (err) { alert(`No se pudo subir: ${err.message}`); }
  };
  $('st-mark').onclick = () => { if (sel()) send({ type: 'STINGER_CUT', file: sel(), at: cutValue(video) }); };
  num.onchange = () => {
    const at = Number(num.value);
    if (sel() && num.value !== '' && Number.isFinite(at) && at >= 0) send({ type: 'STINGER_CUT', file: sel(), at });
  };
  range.oninput = () => { video.currentTime = Number(range.value); };
  video.addEventListener?.('loadedmetadata', () => { range.max = String(video.duration || 0); });
  video.addEventListener?.('timeupdate', () => { if (document.activeElement !== range) range.value = String(video.currentTime); });

  return {
    render(s) {
      state = s;
      renderStingerList(list, s);
      const cur = s.stingers.find((x) => x.file === s.stingerSelected);
      editor.hidden = !cur;
      if (!cur) { video.pause?.(); return; }
      if (video.dataset.file !== cur.file) { // solo se recarga el video si cambió la elegida
        video.dataset.file = cur.file;
        video.setAttribute('src', `/vtr/${encodeURIComponent(cur.file)}`);
      }
      if (document.activeElement !== num) num.value = String(cur.cutAt);
    },
  };
}
