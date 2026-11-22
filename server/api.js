import { viewLink, pushLink } from './links.js';
import { commandToAction } from './commands.js';
import { originAllowed } from './origin.js';

// GET /api/sources -> [{id, kind, url}] (url null para el VTR)
// Equipo "efectivo" de una cámara: la sala sale del estado (editable en el panel), no solo de la config.
function effectiveTeam(config, state, i) {
  const cams = config.aerial ? [...config.teams, config.aerial] : config.teams;
  const t = cams[i];
  const room = state.conn.rooms[`cam${i + 1}`];
  return t.source.kind === 'vdo' && room ? { ...t, source: { ...t.source, room } } : t;
}

// GET /api/sources -> [{id, kind, url}]. ?for=control usa el bitrate chico de los tiles; el resto (program) el de salida.
export function sourcesRoute(config, profile = { tileBitrate: 2000, programBitrate: 3000 }) {
  return async (req, res, url, ctx) => {
    if (url.pathname !== '/api/sources') return false;
    const state = ctx.getState();
    const control = url.searchParams.get('for') === 'control';
    const opts = { bitrate: control ? profile.tileBitrate : profile.programBitrate, meter: control, password: state.conn.password };
    const cams = config.aerial ? [...config.teams, config.aerial] : config.teams;
    const list = cams.map((_, i) => ({ id: `cam${i + 1}`, kind: cams[i].source.kind, url: viewLink(effectiveTeam(config, state, i), opts) }));
    list.push({ id: 'vtr', kind: 'vtr', url: null });
    list.push({ id: 'split', kind: 'split', url: null });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(list));
    return true;
  };
}

// GET /api/links -> por cámara activa: sala y links (navegador, OBS cámara virtual, vista) con la contraseña y calidad actuales.
export function linksRoute(config) {
  return async (req, res, url, ctx) => {
    if (url.pathname !== '/api/links') return false;
    const state = ctx.getState();
    const { password, quality, fps } = state.conn;
    const cams = config.aerial ? [...config.teams, config.aerial] : config.teams;
    const out = state.sources.filter((s) => s.active && s.kind !== 'vtr' && s.kind !== 'split').map((s) => {
      const i = cams.findIndex((_, k) => `cam${k + 1}` === s.id);
      const team = effectiveTeam(config, state, i);
      if (s.kind !== 'vdo') return { id: s.id, label: s.label, kind: s.kind, channel: team.source.channel };
      return {
        id: s.id, label: s.label, kind: 'vdo', room: team.source.room, password,
        browser: pushLink(team, { quality, fps, password, mode: 'browser' }),
        vcam: pushLink(team, { quality, fps, password, mode: 'vcam' }),
        view: viewLink(team, { password }),
      };
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(out));
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
