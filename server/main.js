import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from './index.js';
import { loadConfig } from './config.js';
import { sourcesRoute, teamsRoute } from './api.js';
import { startSheetPoller } from './sheets.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const real = here('../config/teams.json');
const cfgPath = process.env.CONFIG ?? (fs.existsSync(real) ? real : here('../config/teams.example.json'));
if (cfgPath.endsWith('teams.example.json')) console.warn('Usando config/teams.example.json — copia a config/teams.json y edítalo.');

const config = loadConfig(cfgPath);
const port = Number(process.env.PORT ?? 3000);
const srv = await startServer({ port, config, publicDir: here('../public'), extraRoutes: [sourcesRoute(config), teamsRoute(config)] });
console.log(`Control: http://localhost:${srv.port}/control/   Program (OBS): http://localhost:${srv.port}/program/`);

if (config.sheet) {
  startSheetPoller({
    sheet: config.sheet,
    onUpdate: (teams) => srv.dispatch({ type: 'SCOREBOARD_UPDATE', teams }),
    onStale: () => srv.dispatch({ type: 'SCOREBOARD_STALE' }),
  });
  console.log('Marcador: leyendo Google Sheets cada ~3 s');
}
