// Genera un .bat por cada comando del macropad en macropad/botones/ (ej.: cut.bat, emergency-toggle.bat).
// Sirve cuando el software del macropad solo deja elegir un archivo y no permite pasarle argumentos.
// Uso: npm run botones   (vuelve a generarlos si se añaden comandos nuevos)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from '../server/commands.js';

const SAFE = /^[a-z0-9-]+$/; // los nombres de comando son solo minúsculas, números y guiones

export function launcherText(name) {
  if (typeof name !== 'string' || !SAFE.test(name)) throw new Error(`comando no válido para un .bat: ${String(name)}`);
  return [
    '@echo off',
    `rem Multicam: ${name}. Funciona aunque el foco esté en OBS. Puerto distinto: variable MULTICAM_PORT.`,
    'if "%MULTICAM_PORT%"=="" set MULTICAM_PORT=3000',
    `curl.exe -s -X POST http://127.0.0.1:%MULTICAM_PORT%/api/do/${name} >nul`,
    '',
  ].join('\r\n');
}

export function writeLaunchers(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of COMMANDS) fs.writeFileSync(path.join(dir, `${name}.bat`), launcherText(name));
  return COMMANDS.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = fileURLToPath(new URL('./botones', import.meta.url));
  console.log(`Listo: ${writeLaunchers(dir)} archivos en ${dir}`);
}
