// Tecla -> acción del switcher. Base del mapeo del macropad.
export function keyToAction(key) {
  if (typeof key !== 'string') return null;
  if (/^[1-9]$/.test(key)) return { type: 'SET_PREVIEW', id: `cam${key}` }; // 9 = cámara aérea (si existe)
  if (key === '0') return { type: 'SET_PREVIEW', id: 'vtr' };
  if (key === 's') return { type: 'SET_PREVIEW', id: 'split' };
  if (key === ' ') return { type: 'TAKE', mode: 'cut' };
  if (key === 'Enter') return { type: 'TAKE', mode: 'fade' };
  if (key === 't') return { type: 'STINGER_PLAY' };
  if (key === ']') return { type: 'PREVIEW_STEP', dir: 1 };
  if (key === '[') return { type: 'PREVIEW_STEP', dir: -1 };
  if (key === '=') return { type: 'ADJUST_VOLUME', target: 'cam', delta: 0.05 };
  if (key === '-') return { type: 'ADJUST_VOLUME', target: 'cam', delta: -0.05 };
  if (key === 'm') return { type: 'TOGGLE_MUTE', target: 'cam' };
  if (key === '.') return { type: 'VTR_NEXT' };
  if (key === ',') return { type: 'VTR_PREV' };
  if (key === 'p') return { type: 'VTR_TOGGLE' };
  return null;
}

// ¿Debe el panel reaccionar a esta tecla? No en repeticiones (mantener Enter), ni con Ctrl/Alt/Meta, ni escribiendo en un campo.
export function shouldHandleKey(e) {
  if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return false;
  if (e.target?.closest?.('input, textarea, select')) return false;
  return true;
}
