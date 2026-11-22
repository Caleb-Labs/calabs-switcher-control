import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRows, clampInterval, sheetUrl, startSheetPoller } from '../server/sheets.js';

test('parseRows convierte filas [equipo, puntos, posición]', () => {
  assert.deepEqual(parseRows([['Piratas', '12', '1'], ['Kraken', '7', '2']]), [
    { name: 'Piratas', points: 12, position: 1 },
    { name: 'Kraken', points: 7, position: 2 },
  ]);
});

test('parseRows salta filas vacías o sin nombre y tolera filas cortas', () => {
  const out = parseRows([[], [''], ['  ', '5', '1'], ['Solo nombre'], ['Ok', '3', '2']]);
  assert.deepEqual(out.map((t) => t.name), ['Solo nombre', 'Ok']);
});

test('parseRows: puntos no numéricos cuentan 0; posición inválida cae al orden de la fila', () => {
  const out = parseRows([['A', 'abc', ''], ['B', '4', 'x']]);
  assert.deepEqual(out, [{ name: 'A', points: 0, position: 1 }, { name: 'B', points: 4, position: 2 }]);
});

test('parseRows con datos que no son una matriz devuelve []', () => {
  assert.deepEqual(parseRows(undefined), []);
  assert.deepEqual(parseRows('hola'), []);
});

test('clampInterval deja el sondeo entre 2000 y 5000 ms', () => {
  assert.equal(clampInterval(100), 2000);
  assert.equal(clampInterval(3000), 3000);
  assert.equal(clampInterval(60000), 5000);
  assert.equal(clampInterval(undefined), 3000);
});

test('sheetUrl usa la API v4 con el rango codificado y la clave', () => {
  const u = new URL(sheetUrl({ id: 'abc', range: 'Marcador!A2:C9', apiKey: 'K' }));
  assert.equal(u.origin, 'https://sheets.googleapis.com');
  assert.equal(u.pathname, '/v4/spreadsheets/abc/values/Marcador!A2:C9');
  assert.equal(u.searchParams.get('key'), 'K');
});

const sheet = { id: 'abc', range: 'M!A2:C9', apiKey: 'K' };
const ok = (values) => async () => ({ ok: true, status: 200, json: async () => ({ values }) });
function harness(fetchFn) {
  const events = [];
  const p = startSheetPoller({
    sheet, fetchFn, autoStart: false,
    onUpdate: (t) => events.push(['update', t]), onStale: () => events.push(['stale']),
  });
  return { p, events };
}

test('una respuesta válida llama onUpdate con los equipos', async () => {
  const { p, events } = harness(ok([['A', '1', '1']]));
  await p.tick();
  assert.deepEqual(events, [['update', [{ name: 'A', points: 1, position: 1 }]]]);
});

test('429, fetch que lanza, JSON roto u hoja vacía llaman onStale y nunca onUpdate', async () => {
  const cases = [
    async () => ({ ok: false, status: 429, json: async () => ({}) }),
    async () => { throw new Error('ECONNRESET'); },
    async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }),
    ok(undefined),
    ok([[], ['']]),
  ];
  for (const f of cases) {
    const { p, events } = harness(f);
    await p.tick();
    assert.deepEqual(events, [['stale']]);
  }
});

test('tras un fallo, la siguiente respuesta válida vuelve a llamar onUpdate', async () => {
  let n = 0;
  const { p, events } = harness(async () => (++n === 1 ? { ok: false, status: 500, json: async () => ({}) } : ok([['A', '2', '1']])()));
  await p.tick(); await p.tick();
  assert.deepEqual(events.map((e) => e[0]), ['stale', 'update']);
});

test('stop() detiene el sondeo', async () => {
  let calls = 0;
  const p = startSheetPoller({
    sheet, intervalMs: 2000, onUpdate() {}, onStale() {},
    fetchFn: async () => { calls++; return { ok: true, status: 200, json: async () => ({ values: [['A', '1', '1']] }) }; },
  });
  await new Promise((r) => setTimeout(r, 50));
  p.stop();
  const after = calls;
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(calls, after);
  assert.ok(after >= 1);
});

test('un fetch colgado se corta por timeout y marca stale (no se queda "fresco" 5 minutos)', async () => {
  const events = [];
  const p = startSheetPoller({
    sheet, autoStart: false, timeoutMs: 50,
    fetchFn: (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
    onUpdate: () => events.push('update'), onStale: () => events.push('stale'),
  });
  const t0 = Date.now();
  await p.tick();
  assert.deepEqual(events, ['stale']);
  assert.ok(Date.now() - t0 < 1000);
});
