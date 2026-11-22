import { viewLink } from './links.js';

// GET /api/sources -> [{id, kind, url}] (url null para el VTR)
export function sourcesRoute(config, linkOpts = {}) {
  return async (req, res, url) => {
    if (url.pathname !== '/api/sources') return false;
    const list = config.teams.map((t, i) => ({ id: `cam${i + 1}`, kind: t.source.kind, url: viewLink(t, linkOpts) }));
    list.push({ id: 'vtr', kind: 'vtr', url: null });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(list));
    return true;
  };
}
