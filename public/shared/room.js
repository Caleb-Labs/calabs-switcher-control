// Nombre de sala (stream ID) de VDO.Ninja: solo letras, números y "_". VDO.Ninja cambia todo lo demás por "_"
// (replace(/[\W]+/g, "_")), así que con un guion la sala del emisor dejaría de coincidir con la que mira el panel.
export const ROOM_RE = /^[A-Za-z0-9_]{3,50}$/;
export const isValidRoom = (s) => typeof s === 'string' && ROOM_RE.test(s);

// Para lo que escribe una persona: lo no permitido pasa a "_" (igual que VDO.Ninja) y se recorta a 50.
export const cleanRoomInput = (s) => String(s ?? '').trim().replace(/[^A-Za-z0-9_]+/g, '_').slice(0, 50);
