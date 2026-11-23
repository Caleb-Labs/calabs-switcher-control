import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COMMANDS } from '../server/commands.js';
import { launcherText, silentLauncherText, writeLaunchers } from '../macropad/generar-botones.js';

test('launcherText: un .bat sin argumentos que manda el comando por POST y respeta MULTICAM_PORT', () => {
  const t = launcherText('cut');
  assert.match(t, /curl\.exe -s -X POST http:\/\/127\.0\.0\.1:%MULTICAM_PORT%\/api\/do\/cut >nul/);
  assert.match(t, /if "%MULTICAM_PORT%"=="" set MULTICAM_PORT=3000/);
  assert.match(t, /^@echo off/);
  assert.ok(t.includes('\r\n'), 'saltos de línea de Windows');
});

test('launcherText rechaza nombres raros (no se puede colar nada en el .bat)', () => {
  for (const bad of ['cut & calc', '../x', 'a b', '', 'cut"', 'a%b', null]) assert.throws(() => launcherText(bad), /comando/i, String(bad));
});

test('silentLauncherText: un .vbs que manda el comando sin abrir ninguna ventana y respeta MULTICAM_PORT', () => {
  const t = silentLauncherText('emergency-toggle');
  assert.match(t, /\.Run "curl\.exe -s -X POST http:\/\/127\.0\.0\.1:" & port & "\/api\/do\/emergency-toggle", 0, False/); // 0 = ventana oculta
  assert.match(t, /MULTICAM_PORT/);
  assert.match(t, /port = "3000"/);
  assert.ok(t.includes('\r\n'));
  for (const bad of ['cut & calc', 'a b', '', 'cut"', null]) assert.throws(() => silentLauncherText(bad), /comando/i, String(bad));
});

test('writeLaunchers crea un .bat y un .vbs (sin ventana) por cada comando y no toca otros archivos', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'btn-'));
  try {
    fs.writeFileSync(path.join(dir, 'mio.txt'), 'x');
    const n = writeLaunchers(dir);
    assert.equal(n, COMMANDS.length * 2);
    for (const c of COMMANDS) { assert.ok(fs.existsSync(path.join(dir, `${c}.bat`)), c); assert.ok(fs.existsSync(path.join(dir, `${c}.vbs`)), c); }
    assert.equal(fs.readFileSync(path.join(dir, 'mio.txt'), 'utf8'), 'x');
    assert.ok(COMMANDS.includes('emergency-toggle') && COMMANDS.includes('cut'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
