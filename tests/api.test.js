import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.js';
import { sourcesRoute, teamsRoute } from '../server/api.js';
import { loadConfig } from '../server/config.js';

const config = loadConfig(fileURLToPath(new URL('../config/teams.example.json', import.meta.url)));
const srv = await startServer({
  port: 0, config, publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  extraRoutes: [sourcesRoute(config), teamsRoute(config)],
});
after(() => srv.close());

test('/api/sources lista 8 cámaras con su url (vdo o twitch) y el vtr sin url', async () => {
  const res = await fetch(`http://127.0.0.1:${srv.port}/api/sources`);
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.equal(list.length, 9);
  assert.equal(list[0].id, 'cam1');
  assert.match(list[0].url, /^https:\/\/vdo\.ninja\/\?view=sot-torneo-eq1/);
  assert.match(list[6].url, /^https:\/\/player\.twitch\.tv\//);
  assert.deepEqual(list[8], { id: 'vtr', kind: 'vtr', url: null });
});

test('/api/teams lista nombre, jugadores y logo de cada equipo', async () => {
  const list = await (await fetch(`http://127.0.0.1:${srv.port}/api/teams`)).json();
  assert.equal(list.length, 8);
  assert.deepEqual(list[0], { id: 'cam1', name: 'Equipo 1', players: ['Jugador 1A', 'Jugador 1B'], logo: 'logos/eq1.png' });
  assert.equal(list[1].logo, null);
});
