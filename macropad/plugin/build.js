// Arma el plugin del macropad: pantalla de ajustes (desde las etiquetas), iconos PNG y el paquete .sdPlugin (zip) para importar.
// Uso: npm run plugin   ->   macropad/plugin/dist/com.multicam.control.sdPlugin
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { ETIQUETAS, GRUPOS } from './etiquetas.js';

export const PLUGIN_ID = 'com.multicam.control.sdPlugin';
export const PLUGIN_DIR = fileURLToPath(new URL(`./fuente/${PLUGIN_ID}`, import.meta.url));
const DIST = fileURLToPath(new URL('./dist', import.meta.url));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- pantalla de ajustes de la tecla (sin recursos externos: funciona sin internet) ----------
export function comandoHtml() {
  const grupos = GRUPOS.map((g) => `        <optgroup label="${esc(g.nombre)}">\n${g.comandos.map((c) => `          <option value="${esc(c)}">${esc(ETIQUETAS[c])}</option>`).join('\n')}\n        </optgroup>`).join('\n');
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Comando Multicam</title>
  <style>
    body { margin: 0; padding: 10px 12px; background: #2d2d2d; color: #d8d8d8; font: 11px/1.4 "Segoe UI", system-ui, sans-serif; }
    .fila { display: flex; align-items: center; margin: 8px 0; gap: 10px; }
    label { width: 78px; color: #9a9a9a; flex: none; }
    select, input { flex: 1; min-width: 0; background: #3d3d3d; color: #e6e6e6; border: 1px solid #1f1f1f; border-radius: 3px; padding: 5px 6px; font: inherit; }
    .nota { color: #8a8a8a; margin: 10px 0 0 88px; }
  </style>
</head>
<body>
  <div class="fila">
    <label for="comando">Comando</label>
    <select id="comando">
        <option value="">Elige un comando…</option>
${grupos}
    </select>
  </div>
  <div class="fila">
    <label for="puerto">Puerto</label>
    <input id="puerto" type="number" min="1" max="65535" placeholder="3000">
  </div>
  <div class="nota">La app Multicam debe estar abierta. Puerto 3000 salvo que lo hayas cambiado.</div>
  <script>
    var ws = null, uuid = null, settings = {};
    function pintar() {
      document.getElementById('comando').value = settings.command || '';
      document.getElementById('puerto').value = settings.port || '';
    }
    function guardar() {
      settings = { command: document.getElementById('comando').value, port: Number(document.getElementById('puerto').value) || undefined };
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ event: 'setSettings', context: uuid, payload: settings }));
    }
    function connectElgatoStreamDeckSocket(port, inUUID, registerEvent, info, actionInfo) {
      uuid = inUUID;
      try { settings = (JSON.parse(actionInfo).payload || {}).settings || {}; } catch (e) { settings = {}; }
      pintar();
      ws = new WebSocket('ws://127.0.0.1:' + port);
      ws.onopen = function () { ws.send(JSON.stringify({ event: registerEvent, uuid: uuid })); };
      ws.onmessage = function (e) {
        var m = JSON.parse(e.data);
        if (m.event === 'didReceiveSettings') { settings = (m.payload || {}).settings || {}; pintar(); }
      };
    }
    document.getElementById('comando').onchange = guardar;
    document.getElementById('puerto').onchange = guardar;
  </script>
</body>
</html>
`;
}

// ---------- CRC32 y PNG (sin librerías) ----------
const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

// Icono: fondo oscuro redondeado con tres deslizadores (como el mezclador) y la perilla del medio en naranja.
export function drawIcon(size) {
  const S = 4, W = size * S;
  const px = new Uint8Array(W * W * 4);
  const rr = (x, y, w, h, r, [R, G, B]) => {
    const x0 = Math.floor(x * W), y0 = Math.floor(y * W), x1 = Math.ceil((x + w) * W), y1 = Math.ceil((y + h) * W), rad = r * W;
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) {
      const cx = Math.min(Math.max(i + 0.5, x0 + rad), x1 - rad), cy = Math.min(Math.max(j + 0.5, y0 + rad), y1 - rad);
      if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 <= rad * rad) { const o = (j * W + i) * 4; px[o] = R; px[o + 1] = G; px[o + 2] = B; px[o + 3] = 255; }
    }
  };
  rr(0, 0, 1, 1, 0.2, [23, 25, 30]);
  const knobs = [[0.27, 0.34, [207, 211, 218]], [0.5, 0.58, [201, 138, 75]], [0.73, 0.42, [207, 211, 218]]];
  for (const [cx, ky, col] of knobs) {
    rr(cx - 0.025, 0.17, 0.05, 0.66, 0.025, [74, 80, 92]);        // riel
    rr(cx - 0.095, ky - 0.045, 0.19, 0.09, 0.03, col);             // perilla
  }
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const o = ((y * S + j) * W + x * S + i) * 4; const al = px[o + 3]; r += px[o] * al; g += px[o + 1] * al; b += px[o + 2] * al; a += al; }
    const o = (y * size + x) * 4;
    if (a) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); out[o + 3] = Math.round(a / (S * S)); }
  }
  return encodePng(size, size, out);
}

const ICONOS = [['plugin/icon', 256], ['plugin/category', 28], ['accion/lista', 20], ['accion/tecla', 72]];
export function writeIcons(dir = PLUGIN_DIR) {
  for (const [name, size] of ICONOS) {
    for (const [suffix, k] of [['', 1], ['@2x', 2]]) {
      const file = path.join(dir, 'imgs', `${name}${suffix}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, drawIcon(size * k));
    }
  }
}

// ---------- zip (con deflate) ----------
function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) { out.push({ name: `${rel}/`, data: Buffer.alloc(0), dir: true }); out.push(...walk(path.join(dir, e.name), rel)); }
    else out.push({ name: rel, data: fs.readFileSync(path.join(dir, e.name)) });
  }
  return out;
}
export function zipEntries(entries) {
  const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const method = e.dir ? 0 : 8;
    const body = e.dir ? Buffer.alloc(0) : zlib.deflateRawSync(e.data);
    const crc = e.dir ? 0 : crc32(e.data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(e.data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(DOS_TIME, 12); ch.writeUInt16LE(DOS_DATE, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(e.data.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(e.dir ? 0x10 : 0, 38); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += lh.length + name.length + body.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

export function buildPlugin(outDir = DIST) {
  const entries = [{ name: `${PLUGIN_ID}/`, data: Buffer.alloc(0), dir: true }, ...walk(PLUGIN_DIR, PLUGIN_ID)];
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, PLUGIN_ID);
  fs.writeFileSync(file, zipEntries(entries));
  return file;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.writeFileSync(path.join(PLUGIN_DIR, 'ui', 'comando.html'), comandoHtml());
  writeIcons();
  console.log(`Listo: ${buildPlugin()}`);
}
