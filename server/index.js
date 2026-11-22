import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { createState, reduce } from './state.js';
import { originAllowed } from './origin.js';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
};

async function serveStatic(root, urlPath, res) {
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch { rel = null; }
  const abs = rel === null ? null : path.resolve(root, '.' + rel);
  if (!abs || (abs !== root && !abs.startsWith(root + path.sep))) { res.writeHead(404).end('not found'); return; }
  try {
    let file = abs;
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const data = await fs.readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
}

// Acciones que puede mandar un cliente. SCOREBOARD_* y VTR_FILES son internas del servidor.
const CLIENT_ACTIONS = new Set([
  'SET_PREVIEW', 'TAKE', 'SET_AUDIO_MASTER', 'SOURCE_STATUS', 'GC_ARM', 'GC_LIVE', 'GC_OFF',
  'EMERGENCY', 'VTR_SELECT', 'VTR_PLAY', 'VTR_PAUSE', 'VTR_NEXT',
  'VTR_PREV', 'VTR_TOGGLE', 'PREVIEW_STEP', 'AUDIO_MASTER_STEP', 'ADJUST_VOLUME', 'TOGGLE_MUTE',
  'EMERGENCY_TOGGLE', 'GC_NAME_PREVIEW', 'GC_PLAYER_NEXT',
]);

export async function startServer({ port = 3000, host = '127.0.0.1', config, publicDir, extraRoutes = [] }) {
  let state = createState(config);
  const root = path.resolve(publicDir);

  const server = http.createServer(async (req, res) => {
    try {
      let url;
      try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400).end('bad request'); return; }
      for (const route of extraRoutes) {
        if (await route(req, res, url, { getState: () => state, dispatch })) return;
      }
      await serveStatic(root, url.pathname, res);
    } catch (e) {
      console.error('request error:', e);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  const wss = new WebSocketServer({ server, path: '/ws', verifyClient: ({ req }) => originAllowed(req) });

  const broadcast = () => {
    const msg = JSON.stringify({ type: 'state', state });
    for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
  };
  const dispatch = (action) => {
    const next = reduce(state, action);
    if (next !== state) { state = next; broadcast(); }
  };

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'state', state }));
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (msg?.type === 'action' && CLIENT_ACTIONS.has(msg.action?.type)) dispatch(msg.action);
    });
    ws.on('error', () => {});
  });

  await new Promise((resolve) => server.listen(port, host, resolve));
  return {
    port: server.address().port,
    host,
    getState: () => state,
    dispatch,
    close: () => new Promise((resolve) => {
      for (const c of wss.clients) c.terminate();
      wss.close(() => server.close(() => resolve()));
    }),
  };
}
