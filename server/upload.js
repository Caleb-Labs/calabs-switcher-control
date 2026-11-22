import fs from 'node:fs';
import path from 'node:path';
import { originAllowed } from './origin.js';
import { listMedia } from './vtr.js';

const EXTS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.mp4', '.webm', '.mov']);

// Deja solo el nombre de archivo (sin rutas) y caracteres seguros. Devuelve null si no es válido.
export function safeName(raw) {
  if (typeof raw !== 'string') return null;
  let name = raw.split(/[\\/]/).pop().replace(/[^\p{L}\p{N} ._()\-]/gu, '_').trim().replace(/^\.+/, '');
  const ext = path.extname(name).toLowerCase();
  if (!name || !EXTS.has(ext)) return null;
  if (name.length > 100) name = name.slice(0, 100 - ext.length) + ext;
  return name;
}

// POST /api/upload?name=<archivo> con el archivo como cuerpo. Guarda en la carpeta del VTR y actualiza la lista al instante.
export function uploadRoute({ dir, maxBytes = 300 * 1024 * 1024 }) {
  const root = path.resolve(dir);
  return async (req, res, url, ctx) => {
    if (url.pathname !== '/api/upload') return false;
    const reply = (status, body, extra = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...extra }); res.end(JSON.stringify(body)); return true; };
    if (!originAllowed(req)) return reply(403, { ok: false, error: 'origen no permitido' });
    if (req.method !== 'POST') return reply(405, { ok: false, error: 'usa POST' });
    const name = safeName(url.searchParams.get('name'));
    if (!name) return reply(400, { ok: false, error: 'nombre o extensión no permitidos (png, jpg, svg, mp4, webm, mov)' });
    if (Number(req.headers['content-length']) > maxBytes) { req.resume(); return reply(413, { ok: false, error: 'archivo demasiado grande' }); }

    fs.mkdirSync(root, { recursive: true });
    const tmp = path.join(root, `.${name}.part`);
    const out = fs.createWriteStream(tmp);
    let size = 0;
    let failed = false;
    const fail = (status, error) => {
      if (failed) return;
      failed = true;
      out.destroy();
      fs.rm(tmp, { force: true }, () => {});
      if (!res.headersSent) reply(status, { ok: false, error }, { connection: 'close' });
      req.resume();
    };
    return new Promise((resolve) => {
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) { fail(413, 'archivo demasiado grande'); return; }
        if (!failed) out.write(chunk);
      });
      req.on('end', () => {
        if (failed) return resolve(true);
        out.end(() => {
          try {
            fs.renameSync(tmp, path.join(root, name)); // atómico; reemplaza si ya existía
            ctx.dispatch({ type: 'VTR_FILES', files: ['@tabla', ...listMedia(root)] });
            reply(200, { ok: true, name });
          } catch (e) {
            fs.rmSync(tmp, { force: true });
            reply(500, { ok: false, error: e.message });
          }
          resolve(true);
        });
      });
      req.on('error', () => { fail(400, 'subida interrumpida'); resolve(true); });
      req.on('aborted', () => { fail(400, 'subida interrumpida'); resolve(true); });
      out.on('error', () => { fail(500, 'no se pudo guardar'); resolve(true); });
      req.on('close', () => { if (failed) resolve(true); });
    });
  };
}
