// Barra de páginas de abajo (estilo ATEM): el multiview y CUT/FADE/EMERGENCIA quedan arriba siempre; aquí cambia lo de abajo.
export const TABS = ['mezclador', 'camaras', 'conexion', 'audio', 'multimedia', 'gc', 'ajustes'];
export const DEFAULT_TAB = 'mezclador';
export const isTab = (n) => TABS.includes(n);

export function initTabs(root = document) {
  const buttons = [...root.querySelectorAll('#tabs .tab')];
  const pages = [...root.querySelectorAll('#pages .page')];
  const show = (name) => {
    const tab = isTab(name) ? name : DEFAULT_TAB;
    for (const p of pages) p.hidden = p.dataset.page !== tab;
    for (const b of buttons) { const on = b.dataset.tab === tab; b.classList.toggle('active', on); b.setAttribute('aria-current', on ? 'page' : 'false'); }
    try { localStorage.setItem('multicam.tab', tab); } catch { /* sin almacenamiento: no se recuerda */ }
    return tab;
  };
  for (const b of buttons) b.onclick = () => { show(b.dataset.tab); b.blur(); }; // sin foco, las teclas 1-9/Espacio siguen siendo del switcher
  let saved = null;
  try { saved = localStorage.getItem('multicam.tab'); } catch { /* nada */ }
  return show(saved);
}
