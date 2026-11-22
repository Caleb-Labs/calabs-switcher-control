import fs from 'node:fs';
import path from 'node:path';

export function loadSplit(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

export function saveSplit(file, split) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(split, null, 2));
  fs.renameSync(tmp, file); // escritura atómica: un corte de luz no deja el archivo a medias
}
