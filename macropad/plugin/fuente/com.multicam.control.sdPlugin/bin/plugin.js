// Plugin "Multicam": acciones de tecla y de dial (rueda) que mandan un comando a la app Multicam (POST /api/do/<comando>).
// Lo lanza el software del macropad con: node plugin.js -port N -pluginUUID U -registerEvent E -info J
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectWS } from './wsclient.js';

export const ACTION = 'com.multicam.control.comando';
export const DIAL_ACTION = 'com.multicam.control.dial';
const MAX_STEPS = 10; // pasos máximos por giro: un giro muy rápido no inunda la app
const COMMAND_RE = /^[a-z0-9-]{1,40}$/;

export function parseArgs(argv) {
  const out = { port: null, pluginUUID: null, registerEvent: null, info: null };
  for (let i = 0; i < argv.length - 1; i++) {
    const v = argv[i + 1];
    if (argv[i] === '-port') out.port = Number(v);
    else if (argv[i] === '-pluginUUID') out.pluginUUID = v;
    else if (argv[i] === '-registerEvent') out.registerEvent = v;
    else if (argv[i] === '-info') out.info = v;
  }
  return out;
}

// Solo letras minúsculas, números y guiones (nada que se pueda colar en la dirección).
export const isValidCommand = (c) => typeof c === 'string' && COMMAND_RE.test(c);

// true si Multicam aceptó el comando (200); false si no responde, se demora o lo rechaza.
export function postCommand(command, port = 3000, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: `/api/do/${command}`, method: 'POST', timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

// Nombres de evento: Elgato usa dialRotate/dialDown/dialPress; los programas que llaman «Knob» a las ruedas pueden usar knob*.
const ROTATE = new Set(['dialRotate', 'knobRotate']);
const DOWN = new Set(['dialDown', 'knobDown']);
const PRESS = new Set(['dialPress', 'knobPress']); // trae payload.pressed (true al bajar)

// Pasos de un giro: payload.ticks (positivo = derecha) o, si no viene, payload.direction como texto.
function stepsOf(payload) {
  const n = Math.trunc(Number(payload?.ticks));
  if (Number.isFinite(n) && n !== 0) return n;
  const d = typeof payload?.direction === 'string' ? payload.direction.toLowerCase() : '';
  if (/counter|anti|left|ccw/.test(d)) return -1; // «counterclockwise» contiene «clock»: se mira antes
  if (/right|clock|cw/.test(d)) return 1;
  return 0;
}

// Qué comandos hay que mandar por un mensaje del software (lista vacía = nada que hacer).
export function commandsFor(msg) {
  if (!msg || typeof msg !== 'object') return [];
  const s = msg.payload?.settings ?? {};
  if (msg.action === ACTION) return msg.event === 'keyDown' && isValidCommand(s.command) ? [s.command] : [];
  if (msg.action !== DIAL_ACTION) return [];
  const push = isValidCommand(s.push) ? [s.push] : [];
  if (ROTATE.has(msg.event)) {
    const ticks = stepsOf(msg.payload);
    if (!ticks) return [];
    const cmd = ticks > 0 ? s.right : s.left;
    return isValidCommand(cmd) ? Array(Math.min(MAX_STEPS, Math.abs(ticks))).fill(cmd) : [];
  }
  if (DOWN.has(msg.event)) return push;
  if (PRESS.has(msg.event)) return msg.payload?.pressed === true ? push : [];
  if (msg.event === 'keyDown') return push; // si el software deja la acción en una tecla, pulsarla = «Presionar»
  return [];
}

// Línea de diagnóstico de un evento de NUESTRO dial: qué evento llegó y con qué campos (para ver cómo habla el software).
export function logLine(msg, now = new Date()) {
  if (!msg || msg.action !== DIAL_ACTION || typeof msg.event !== 'string') return null;
  const p = msg.payload ?? {};
  const keys = Object.keys(p).join(',');
  const extra = ['controller', 'ticks', 'direction', 'pressed'].filter((k) => k in p).map((k) => `${k}=${String(p[k])}`).join(' ');
  return `${now.toISOString()} ${msg.event} ${extra} payload:[${keys}]`.replace(/\s+/g, ' ');
}

const LOG_FILE = path.join(os.tmpdir(), 'multicam-plugin.log');
let logged = 0;
function writeLog(line) {
  if (!line || logged >= 400) return; // tope: es solo para diagnosticar
  logged++;
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch { /* sin permiso para escribir: se ignora */ }
}

const portOf = (settings) => { const p = Number(settings?.port); return Number.isInteger(p) && p > 0 && p < 65536 ? p : 3000; };

export function startPlugin({ port, pluginUUID, registerEvent }) {
  let queue = Promise.resolve(); // las pulsaciones y giros se atienden en el orden en que llegan (derecha, izquierda, derecha...)
  const ws = connectWS(`ws://127.0.0.1:${port}`, {
    onMessage: (text) => { queue = queue.then(() => handle(text)).catch(() => {}); },
    onClose: () => process.exit(0), // el software cerró la conexión: el plugin termina (lo vuelve a lanzar él)
  });

  async function handle(text) {
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    writeLog(logLine(msg));
    const cmds = commandsFor(msg);
    const keyWithoutCommand = msg.event === 'keyDown' && msg.action === ACTION && !cmds.length; // tecla sin configurar
    let ok = !keyWithoutCommand;
    const p = portOf(msg.payload?.settings);
    for (const c of cmds) { if (!(ok = await postCommand(c, p))) break; } // en orden; si uno falla, se corta
    if (!ok) ws.send(JSON.stringify({ event: 'showAlert', context: msg.context })); // muestra ✗ si no llegó (una vez por pulsación o giro)
  }

  ws.ready.then(() => ws.send(JSON.stringify({ event: registerEvent, uuid: pluginUUID }))).catch(() => process.exit(1));
  return ws;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  if (args.port) startPlugin(args);
}
