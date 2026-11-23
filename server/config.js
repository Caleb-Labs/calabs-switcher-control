import fs from 'node:fs';
import { isValidRoom, cleanRoomInput } from '../public/shared/room.js';

// Valida una fuente y devuelve una copia normalizada (no modifica lo que recibe).
function checkSource(s, label) {
  if (s?.kind === 'vdo') {
    // La sala puede ir en blanco (se pone en el panel). Con guiones u otros símbolos se pasa a "_", como hace VDO.Ninja.
    const room = cleanRoomInput(s.room);
    if (room && !isValidRoom(room)) throw new Error(`${label}: la sala "${s.room}" no es válida (3 a 50 letras, números o _)`);
    return { ...s, room };
  }
  if (s?.kind === 'twitch') { if (!s.channel) throw new Error(`${label}: la fuente twitch necesita channel`); return s; }
  throw new Error(`${label}: source.kind debe ser "vdo" o "twitch"`);
}

export function parseConfig(raw) {
  const teams = raw?.teams;
  if (!Array.isArray(teams) || teams.length !== 8) throw new Error('La config necesita exactamente 8 equipos');
  const checked = teams.map((t, i) => {
    const n = i + 1;
    if (typeof t?.name !== 'string' || !t.name.trim()) throw new Error(`Equipo ${n}: falta el nombre`);
    if (!Array.isArray(t.players) || t.players.length !== 2) throw new Error(`Equipo ${n}: necesita 2 jugadores`);
    return { ...t, source: checkSource(t.source, `Equipo ${n}`) };
  });
  let aerial = null;
  if (raw.aerial != null) {
    if (typeof raw.aerial.name !== 'string' || !raw.aerial.name.trim()) throw new Error('Cámara aérea: falta el nombre');
    aerial = { ...raw.aerial, source: checkSource(raw.aerial.source, 'Cámara aérea') };
  }
  return { teams: checked, aerial, sheet: raw.sheet ?? null, emergencyLogo: raw.emergencyLogo ?? null, vtrDefault: raw.vtrDefault ?? null, profile: raw.profile };
}

export function loadConfig(path) {
  return parseConfig(JSON.parse(fs.readFileSync(path, 'utf8')));
}
