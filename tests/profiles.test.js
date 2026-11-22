import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadProfile, readProfiles } from '../server/profiles.js';
import { startServer } from '../server/index.js';
import { sourcesRoute } from '../server/api.js';
import { loadConfig } from '../server/config.js';

const file = fileURLToPath(new URL('../config/profiles.json', import.meta.url));
const profiles = readProfiles(file);

test('el perfil 720p queda entre 2 y 4 Mbps y los perfiles bajan de más a menos', () => {
  const p = loadProfile('720p', profiles);
  assert.ok(p.programBitrate >= 2000 && p.programBitrate <= 4000);
  assert.ok(loadProfile('ligero', profiles).programBitrate < loadProfile('480p-tiles', profiles).programBitrate);
  assert.ok(loadProfile('ligero', profiles).tileBitrate < p.tileBitrate);
});

test('loadProfile: perfil desconocido o vacío cae al por defecto y avisa en consola', () => {
  const warnings = [];
  const p = loadProfile('no-existe', profiles, (m) => warnings.push(m));
  assert.deepEqual(p, loadProfile(profiles.default, profiles));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /no-existe/);
  assert.deepEqual(loadProfile(undefined, profiles, () => {}), p);
  assert.ok(profiles.profiles['1080p30'].programBitrate >= 4000);
});

test('readProfiles con archivo inexistente devuelve un perfil de emergencia usable', () => {
  const fallback = readProfiles('/no/existe/profiles.json');
  const p = loadProfile('720p', fallback, () => {});
  assert.equal(typeof p.tileBitrate, 'number');
  assert.equal(typeof p.programBitrate, 'number');
});

const config = loadConfig(fileURLToPath(new URL('../config/teams.example.json', import.meta.url)));
const srv = await startServer({
  port: 0, config, publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  extraRoutes: [sourcesRoute(config, { tileBitrate: 800, programBitrate: 2500 })],
});
after(() => srv.close());

test('/api/sources?for=control usa tileBitrate y el resto programBitrate', async () => {
  const get = async (q) => (await (await fetch(`http://127.0.0.1:${srv.port}/api/sources${q}`)).json())[0].url;
  assert.match(await get('?for=control'), /videobitrate=800/);
  assert.match(await get(''), /videobitrate=2500/);
  assert.match(await get('?for=program'), /videobitrate=2500/);
});

test('los links de /control salen con altavoz callado y niveles; los de /program con audio normal', async () => {
  const get = async (q) => (await (await fetch(`http://127.0.0.1:${srv.port}/api/sources${q}`)).json())[0].url;
  assert.match(await get('?for=control'), /mutespeaker/);
  assert.match(await get('?for=control'), /getloudness/);
  assert.doesNotMatch(await get('?for=control'), /noaudio/);
  assert.doesNotMatch(await get(''), /noaudio|mutespeaker|getloudness/);
});
