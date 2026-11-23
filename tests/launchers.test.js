import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COMMANDS } from '../server/commands.js';
import { launcherText, writeLaunchers } from '../macropad/generar-botones.js';

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

test('writeLaunchers crea un .bat por cada comando y no toca otros archivos', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'btn-'));
  try {
    fs.writeFileSync(path.join(dir, 'mio.txt'), 'x');
    const n = writeLaunchers(dir);
    assert.equal(n, COMMANDS.length);
    for (const c of COMMANDS) assert.ok(fs.existsSync(path.join(dir, `${c}.bat`)), c);
    assert.equal(fs.readFileSync(path.join(dir, 'mio.txt'), 'utf8'), 'x');
    assert.ok(COMMANDS.includes('emergency-toggle') && COMMANDS.includes('cut'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
