import { viewLink } from './links.js';
import { commandToAction } from './commands.js';
import { originAllowed } from './origin.js';

// GET /api/sources -> [{id, kind, url}] (url null para el VTR)
// ?for=control usa el bitrate chico de los tiles; el resto (program) el bitrate de salida.
export function sourcesRoute(config, profile = { tileBitrate: 2000, programBitrate: 3000 }) {
  return async (req, res, url) => {
    if (url.pathname !== '/api/sources') return false;
    const control = url.searchParams.get('for') === 'control';
    const opts = { bitrate: control ? profile.tileBitrate : profile.programBitrate, noAudio: control };
    const list = config.teams.map((t, i) => ({ id: `cam${i + 1}`, kind: t.source.kind, url: viewLink(t, opts) }));
    list.push({ id: 'vtr', kind: 'vtr', url: null });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(list));
    return true;
  };
}

// GET /api/teams -> [{id, name, players, logo}] (para el panel de GC)
export function teamsRoute(config) {
  return async (req, res, url) => {
    if (url.pathname !== '/api/teams') return false;
    const list = config.teams.map((t, i) => ({ id: `cam${i + 1}`, name: t.name, players: t.players, logo: t.logo ?? null }));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(list));
    return true;
  };
}

// POST /api/do/<comando>: lo usa el macropad (curl) aunque el foco esté en OBS. Solo POST y sin Origin ajeno.
export function commandRoute() {
  return async (req, res, url, ctx) => {
    if (!url.pathname.startsWith('/api/do/')) return false;
    const reply = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); return true; };
    if (!originAllowed(req)) return reply(403, { ok: false, error: 'origen no permitido' });
    if (req.method !== 'POST') return reply(405, { ok: false, error: 'usa POST' });
    let name;
    try { name = decodeURIComponent(url.pathname.slice('/api/do/'.length)); } catch { name = ''; }
    const action = commandToAction(name);
    if (!action) return reply(404, { ok: false, error: `comando desconocido: ${name}` });
    ctx.dispatch(action);
    return reply(200, { ok: true, action });
  };
}
