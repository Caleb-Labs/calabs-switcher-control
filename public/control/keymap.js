// Tecla -> acción del switcher. Base del mapeo del macropad.
export function keyToAction(key) {
  if (typeof key !== 'string') return null;
  if (/^[1-8]$/.test(key)) return { type: 'SET_PREVIEW', id: `cam${key}` };
  if (key === '9') return { type: 'SET_PREVIEW', id: 'vtr' };
  if (key === 'Enter') return { type: 'TAKE', mode: 'cut' };
  if (key === ' ') return { type: 'TAKE', mode: 'fade' };
  return null;
}
