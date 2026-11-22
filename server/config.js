import fs from 'node:fs';

function checkSource(s, label) {
  if (s?.kind === 'vdo') { if (!s.room) throw new Error(`${label}: la fuente vdo necesita room`); }
  else if (s?.kind === 'twitch') { if (!s.channel) throw new Error(`${label}: la fuente twitch necesita channel`); }
  else throw new Error(`${label}: source.kind debe ser "vdo" o "twitch"`);
}

export function parseConfig(raw) {
  const teams = raw?.teams;
  if (!Array.isArray(teams) || teams.length !== 8) throw new Error('La config necesita exactamente 8 equipos');
  teams.forEach((t, i) => {
    const n = i + 1;
    if (typeof t?.name !== 'string' || !t.name.trim()) throw new Error(`Equipo ${n}: falta el nombre`);
    if (!Array.isArray(t.players) || t.players.length !== 2) throw new Error(`Equipo ${n}: necesita 2 jugadores`);
    checkSource(t.source, `Equipo ${n}`);
  });
  let aerial = null;
  if (raw.aerial != null) {
    if (typeof raw.aerial.name !== 'string' || !raw.aerial.name.trim()) throw new Error('Cámara aérea: falta el nombre');
    checkSource(raw.aerial.source, 'Cámara aérea');
    aerial = raw.aerial;
  }
  return { teams, aerial, sheet: raw.sheet ?? null, emergencyLogo: raw.emergencyLogo ?? null, vtrDefault: raw.vtrDefault ?? null, profile: raw.profile };
}

export function loadConfig(path) {
  return parseConfig(JSON.parse(fs.readFileSync(path, 'utf8')));
}
