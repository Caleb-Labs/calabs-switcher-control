import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadConfig, parseConfig } from '../server/config.js';
import { pushLink, viewLink } from '../server/links.js';

const vdo = (room) => ({ name: 'E', players: ['a', 'b'], source: { kind: 'vdo', room } });
const eight = () => Array.from({ length: 8 }, (_, i) => vdo(`sala${i}`));

test('el ejemplo del repo es una config válida de 8 equipos', () => {
  const cfg = loadConfig(fileURLToPath(new URL('../config/teams.example.json', import.meta.url)));
  assert.equal(cfg.teams.length, 8);
  assert.equal(cfg.sheet, null);
});

test('parseConfig rechaza menos o más de 8 equipos', () => {
  assert.throws(() => parseConfig({ teams: eight().slice(0, 7) }), /8 equipos/);
  assert.throws(() => parseConfig({ teams: [...eight(), vdo('sala9')] }), /8 equipos/);
});

test('parseConfig rechaza equipos sin 2 jugadores, sin nombre o sin fuente válida', () => {
  const bad = (patch) => { const t = eight(); t[0] = { ...t[0], ...patch }; return { teams: t }; };
  assert.throws(() => parseConfig(bad({ players: ['solo uno'] })), /2 jugadores/);
  assert.throws(() => parseConfig(bad({ name: '  ' })), /nombre/);
  assert.equal(parseConfig(bad({ source: { kind: 'vdo' } })).teams[0].source.room, ''); // la sala puede ir en blanco
  assert.throws(() => parseConfig(bad({ source: { kind: 'vdo', room: 'ab' } })), /sala/);
  assert.throws(() => parseConfig(bad({ source: { kind: 'twitch' } })), /channel/);
  assert.throws(() => parseConfig(bad({ source: { kind: 'discord' } })), /kind/);
});

test('pushLink arma el link de envío a 720p', () => {
  const u = new URL(pushLink(vdo('sot-eq1')));
  assert.equal(u.origin + u.pathname, 'https://vdo.ninja/');
  assert.equal(u.searchParams.get('push'), 'sot-eq1');
  assert.equal(u.searchParams.get('quality'), '1');
});

test('viewLink usa view, bitrate pedido (3000 por defecto) y salida limpia', () => {
  const u = new URL(viewLink(vdo('sot-eq1')));
  assert.equal(u.searchParams.get('view'), 'sot-eq1');
  assert.equal(u.searchParams.get('videobitrate'), '3000');
  assert.ok(u.searchParams.has('cleanoutput'));
  assert.equal(new URL(viewLink(vdo('x'), { bitrate: 800 })).searchParams.get('videobitrate'), '800');
});

test('una sala con espacios o caracteres especiales sale codificada', () => {
  const link = pushLink(vdo('mi sala & más'));
  assert.ok(!link.includes(' '));
  assert.equal(new URL(link).searchParams.get('push'), 'mi sala & más');
});

test('viewLink de un equipo Twitch apunta al player de Twitch silenciado', () => {
  const u = new URL(viewLink({ name: 'T', players: ['a', 'b'], source: { kind: 'twitch', channel: 'canal' } }));
  assert.equal(u.hostname, 'player.twitch.tv');
  assert.equal(u.searchParams.get('channel'), 'canal');
  assert.equal(u.searchParams.get('parent'), 'localhost');
  assert.equal(u.searchParams.get('muted'), 'true');
});

test('parseConfig conserva emergencyLogo', () => {
  assert.equal(parseConfig({ teams: eight(), emergencyLogo: '/vtr/e.png' }).emergencyLogo, '/vtr/e.png');
  assert.equal(parseConfig({ teams: eight() }).emergencyLogo, null);
});

test('viewLink con meter calla el altavoz y pide niveles (sin noaudio, que dejaría sin audio que medir); sin él no', () => {
  const p = new URL(viewLink(vdo('x'), { meter: true })).searchParams;
  assert.ok(p.has('mutespeaker') && p.has('getloudness'));
  assert.ok(!p.has('noaudio'));
  const q = new URL(viewLink(vdo('x'))).searchParams;
  assert.ok(!q.has('mutespeaker') && !q.has('getloudness') && !q.has('noaudio'));
});

test('parseConfig acepta una cámara aérea opcional y la valida', () => {
  const aerial = { name: 'Aérea', source: { kind: 'vdo', room: 'aerea' } };
  assert.deepEqual(parseConfig({ teams: eight(), aerial }).aerial, aerial);
  assert.equal(parseConfig({ teams: eight() }).aerial, null);
  assert.throws(() => parseConfig({ teams: eight(), aerial: { name: 'x', source: { kind: 'vdo', room: 'ab' } } }), /aérea.*sala/i);
  assert.throws(() => parseConfig({ teams: eight(), aerial: { source: { kind: 'vdo', room: 'aerea' } } }), /aérea.*nombre/);
});
