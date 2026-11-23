import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.js';
import { sourcesRoute, teamsRoute } from '../server/api.js';
import { loadConfig } from '../server/config.js';

// El ejemplo del repo trae las salas en blanco; aquí se rellenan para probar las urls.
const example = loadConfig(fileURLToPath(new URL('../config/teams.example.json', import.meta.url)));
const config = { ...example, teams: example.teams.map((t, i) => (t.source.kind === 'vdo' ? { ...t, source: { ...t.source, room: `sala_eq${i + 1}` } } : t)), aerial: { ...example.aerial, source: { ...example.aerial.source, room: 'sala_aerea' } } };
const srv = await startServer({
  port: 0, config, publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  extraRoutes: [sourcesRoute(config), teamsRoute(config)],
});
after(() => srv.close());

test('/api/sources lista 8 cámaras con su url (vdo o twitch) y el vtr sin url', async () => {
  const res = await fetch(`http://127.0.0.1:${srv.port}/api/sources`);
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.equal(list.length, 11); // 8 equipos + aérea + vtr + split
  assert.equal(list[0].id, 'cam1');
  assert.match(list[0].url, /^https:\/\/vdo\.ninja\/\?view=sala_eq1/);
  assert.match(list[6].url, /^https:\/\/vdo\.ninja\/\?view=sala_eq7/); // todas las cámaras del ejemplo son VDO.Ninja
  assert.equal(list[8].id, 'cam9');
  assert.match(list[8].url, /^https:\/\/vdo\.ninja\/\?view=sala_aerea/);
  assert.deepEqual(list[9], { id: 'vtr', kind: 'vtr', url: null });
  assert.deepEqual(list[10], { id: 'split', kind: 'split', url: null });
});

test('/api/teams lista nombre, jugadores y logo de cada equipo', async () => {
  const list = await (await fetch(`http://127.0.0.1:${srv.port}/api/teams`)).json();
  assert.equal(list.length, 8);
  assert.deepEqual(list[0], { id: 'cam1', name: 'Equipo 1', players: ['Jugador 1A', 'Jugador 1B'], logo: 'logos/eq1.png' });
  assert.equal(list[1].logo, null);
});
