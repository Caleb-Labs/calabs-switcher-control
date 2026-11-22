import fs from 'node:fs';

const EMERGENCY = { default: '720p', profiles: { '720p': { tileBitrate: 2000, programBitrate: 3000 } } };

export function readProfiles(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return EMERGENCY; }
}

export function loadProfile(name, data, warn = console.warn) {
  const def = data.profiles[data.default] ?? Object.values(data.profiles)[0];
  if (name === undefined || name === '') return def;
  if (data.profiles[name]) return data.profiles[name];
  warn(`Perfil "${name}" no existe; usando "${data.default}". Disponibles: ${Object.keys(data.profiles).join(', ')}`);
  return def;
}
