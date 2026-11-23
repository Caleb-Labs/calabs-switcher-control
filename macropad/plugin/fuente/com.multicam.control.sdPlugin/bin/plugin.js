// Plugin "Multicam": una acción de tecla que manda un comando a la app Multicam (POST /api/do/<comando>).
// Lo lanza el software del macropad con: node plugin.js -port N -pluginUUID U -registerEvent E -info J
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { connectWS } from './wsclient.js';

export const ACTION = 'com.multicam.control.comando';
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

const portOf = (settings) => { const p = Number(settings?.port); return Number.isInteger(p) && p > 0 && p < 65536 ? p : 3000; };

export function startPlugin({ port, pluginUUID, registerEvent }) {
  const ws = connectWS(`ws://127.0.0.1:${port}`, {
    onMessage: async (text) => {
      let msg;
      try { msg = JSON.parse(text); } catch { return; }
      if (msg.event !== 'keyDown' || msg.action !== ACTION) return;
      const settings = msg.payload?.settings ?? {};
      const ok = isValidCommand(settings.command) && await postCommand(settings.command, portOf(settings));
      if (!ok) ws.send(JSON.stringify({ event: 'showAlert', context: msg.context })); // la tecla muestra ✗ si no llegó
    },
    onClose: () => process.exit(0), // el software cerró la conexión: el plugin termina (lo vuelve a lanzar él)
  });
  ws.ready.then(() => ws.send(JSON.stringify({ event: registerEvent, uuid: pluginUUID }))).catch(() => process.exit(1));
  return ws;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  if (args.port) startPlugin(args);
}
