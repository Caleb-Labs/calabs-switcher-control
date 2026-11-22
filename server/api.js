import { viewLink } from './links.js';

// GET /api/sources -> [{id, kind, url}] (url null para el VTR)
// ?for=control usa el bitrate chico de los tiles; el resto (program) el bitrate de salida.
export function sourcesRoute(config, profile = { tileBitrate: 2000, programBitrate: 3000 }) {
  return async (req, res, url) => {
    if (url.pathname !== '/api/sources') return false;
    const bitrate = url.searchParams.get('for') === 'control' ? profile.tileBitrate : profile.programBitrate;
    const list = config.teams.map((t, i) => ({ id: `cam${i + 1}`, kind: t.source.kind, url: viewLink(t, { bitrate }) }));
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
