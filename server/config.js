import fs from 'node:fs';

export function parseConfig(raw) {
  const teams = raw?.teams;
  if (!Array.isArray(teams) || teams.length !== 8) throw new Error('La config necesita exactamente 8 equipos');
  teams.forEach((t, i) => {
    const n = i + 1;
    if (typeof t?.name !== 'string' || !t.name.trim()) throw new Error(`Equipo ${n}: falta el nombre`);
    if (!Array.isArray(t.players) || t.players.length !== 2) throw new Error(`Equipo ${n}: necesita 2 jugadores`);
    const s = t.source;
    if (s?.kind === 'vdo') { if (!s.room) throw new Error(`Equipo ${n}: la fuente vdo necesita room`); }
    else if (s?.kind === 'twitch') { if (!s.channel) throw new Error(`Equipo ${n}: la fuente twitch necesita channel`); }
    else throw new Error(`Equipo ${n}: source.kind debe ser "vdo" o "twitch"`);
  });
  return { teams, sheet: raw.sheet ?? null };
}

export function loadConfig(path) {
  return parseConfig(JSON.parse(fs.readFileSync(path, 'utf8')));
}
