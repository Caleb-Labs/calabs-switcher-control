import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { createState, reduce } from './state.js';

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

export async function startServer({ port = 3000, config, publicDir, extraRoutes = [] }) {
  let state = createState(config);
  const root = path.resolve(publicDir);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    for (const route of extraRoutes) {
      if (await route(req, res, url, { getState: () => state })) return;
    }
    await serveStatic(root, url.pathname, res);
  });
  const wss = new WebSocketServer({ server, path: '/ws' });

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
      if (msg?.type === 'action' && msg.action) dispatch(msg.action);
    });
    ws.on('error', () => {});
  });

  await new Promise((resolve) => server.listen(port, resolve));
  return {
    port: server.address().port,
    getState: () => state,
    dispatch,
    close: () => new Promise((resolve) => {
      for (const c of wss.clients) c.terminate();
      wss.close(() => server.close(() => resolve()));
    }),
  };
}
