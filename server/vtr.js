import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};
const extOf = (name) => path.extname(name).toLowerCase();

export function listMedia(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith('.') && extOf(e.name) in MIME)
    .map((e) => e.name)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// GET /vtr/<archivo> con soporte de Range (necesario para que el navegador pueda buscar en un video).
export function vtrRoute(dir) {
  const root = path.resolve(dir);
  return async (req, res, url) => {
    if (!url.pathname.startsWith('/vtr/')) return false;
    const notFound = () => { res.writeHead(404).end('not found'); return true; };
    let name;
    try { name = decodeURIComponent(url.pathname.slice('/vtr/'.length)); } catch { return notFound(); }
    if (!name || /[\\/]/.test(name) || name.startsWith('.') || !(extOf(name) in MIME)) return notFound();
    const file = path.join(root, name);
    let size;
    try { const st = fs.statSync(file); if (!st.isFile()) return notFound(); size = st.size; } catch { return notFound(); }

    const headers = { 'content-type': MIME[extOf(name)], 'accept-ranges': 'bytes' };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (!m) {
      res.writeHead(200, { ...headers, 'content-length': size });
      fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
      return true;
    }
    let start = m[1] === '' ? size - Number(m[2]) : Number(m[1]);
    let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    if (!(start >= 0 && start <= end && start < size)) { res.writeHead(416, { 'content-range': `bytes */${size}` }).end(); return true; }
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
    return true;
  };
}

// Revisa la carpeta cada pocos segundos y avisa solo si cambió. "@tabla" es un ítem virtual (tabla a pantalla completa).
export function startVtrWatcher({ dir, dispatch, intervalMs = 3000, autoStart = true }) {
  let last = null;
  let timer = null;
  const tick = () => {
    const files = ['@tabla', ...listMedia(dir)];
    const key = JSON.stringify(files);
    if (key === last) return;
    last = key;
    dispatch({ type: 'VTR_FILES', files });
  };
  if (autoStart) { tick(); timer = setInterval(tick, intervalMs); }
  return { tick, stop: () => clearInterval(timer) };
}
