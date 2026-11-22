// npm run links -> imprime el link que cada equipo debe abrir para enviar su juego.
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { loadConfig } from './config.js';
import { pushLink } from './links.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const real = here('../config/teams.json');
const config = loadConfig(process.env.CONFIG ?? (fs.existsSync(real) ? real : here('../config/teams.example.json')));
for (const t of config.aerial ? [...config.teams, config.aerial] : config.teams) {
  console.log(`${t.name}\n  ${t.source.kind === 'vdo' ? pushLink(t, { quality: '1080p', fps: 30 }) : `(Twitch: ${t.source.channel})`}\n`);
}
