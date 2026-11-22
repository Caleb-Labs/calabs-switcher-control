import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { renderGraphic } from '../public/graphics/templates.js';
import { syncGraphics } from '../public/graphics/layer.js';

const setup = () => {
  const { document } = parseHTML('<div id="c"></div>');
  global.document = document;
  return document.getElementById('c');
};

test('gc-name muestra equipo y jugador', () => {
  setup();
  const el = renderGraphic('gc-name', { team: 'Los Piratas', player: 'Jack' });
  assert.match(el.textContent, /Los Piratas/);
  assert.match(el.textContent, /Jack/);
});

test('un nombre de 80 caracteres con tildes y emoji no se corta ni lanza, y lleva clase ellipsis', () => {
  setup();
  const long = 'Ñandú Ángel Ümlaut 🏴‍☠️ '.repeat(6).slice(0, 80);
  const el = renderGraphic('gc-name', { team: long, player: 'x' });
  const t = [...el.querySelectorAll('.ellipsis')].find((n) => n.textContent === long);
  assert.ok(t, 'el texto completo está en un nodo .ellipsis');
});

test('el texto viene de Sheets: se inserta como texto, nunca como HTML', () => {
  setup();
  const el = renderGraphic('gc-name', { team: '<img src=x onerror=alert(1)>', player: 'p' });
  assert.equal(el.querySelectorAll('img').length, 0);
  assert.match(el.textContent, /<img src=x/);
});

test('nosignal muestra "SIN SEÑAL"', () => {
  setup();
  assert.match(renderGraphic('nosignal', {}).textContent, /SIN SEÑAL/);
});

test('emergency muestra el logo configurado', () => {
  setup();
  const el = renderGraphic('emergency', { logo: '/vtr/emergencia.png' });
  assert.equal(el.querySelector('img').getAttribute('src'), '/vtr/emergencia.png');
});

test('emergency sin logo igual renderiza un texto de respaldo', () => {
  setup();
  assert.match(renderGraphic('emergency', {}).textContent, /VOLVEMOS/);
});

test('scoreboard y standings listan equipos en orden de posición; sin datos no fallan', () => {
  setup();
  const teams = [{ name: 'B', points: 5, position: 2 }, { name: 'A', points: 9, position: 1 }];
  const rows = [...renderGraphic('standings', { teams }).querySelectorAll('.row')];
  assert.deepEqual(rows.map((r) => r.querySelector('.name').textContent), ['A', 'B']);
  assert.doesNotThrow(() => renderGraphic('scoreboard', { teams: [] }));
  assert.doesNotThrow(() => renderGraphic('scoreboard', {}));
});

test('plantilla desconocida lanza un error claro', () => {
  setup();
  assert.throws(() => renderGraphic('nope', {}), /plantilla/i);
});

test('syncGraphics muestra solo los GC del estado pedido y no recrea los que no cambian', () => {
  const c = setup();
  const state = {
    gc: {
      name: { template: 'gc-name', data: { team: 'A', player: 'p' }, state: 'preview' },
      score: { template: 'scoreboard', data: {}, state: 'live' },
    },
    scoreboard: { teams: [{ name: 'A', points: 1, position: 1 }] },
    emergency: false,
  };
  syncGraphics(c, state, 'preview');
  assert.deepEqual([...c.children].map((e) => e.dataset.gcId), ['name']);
  const el = c.firstElementChild;
  syncGraphics(c, state, 'preview');
  assert.equal(c.firstElementChild, el);
  syncGraphics(c, state, 'live');
  assert.deepEqual([...c.children].map((e) => e.dataset.gcId), ['score']);
});

test('syncGraphics en live pone la emergencia por encima cuando está activa', () => {
  const c = setup();
  const state = { gc: {}, scoreboard: { teams: [] }, emergency: true, emergencyLogo: '/vtr/e.png' };
  syncGraphics(c, state, 'live');
  assert.equal(c.lastElementChild.dataset.gcId, 'emergency');
  syncGraphics(c, state, 'preview');
  assert.equal(c.children.length, 0);
});

test('datos corruptos no rompen el render: teams que no es arreglo, plantilla desconocida dentro del estado', () => {
  const c = setup();
  assert.doesNotThrow(() => renderGraphic('standings', { teams: 5 }));
  assert.doesNotThrow(() => renderGraphic('scoreboard', { teams: 'x' }));
  const state = { gc: { bad: { template: 'nope', data: {}, state: 'live' }, ok: { template: 'gc-name', data: { team: 'A', player: 'p' }, state: 'live' } }, scoreboard: { teams: 5 }, emergency: false };
  assert.doesNotThrow(() => syncGraphics(c, state, 'live'));
  assert.deepEqual([...c.children].map((e) => e.dataset.gcId), ['ok']);
});
