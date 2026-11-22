// Estado de señal a partir de los mensajes del iframe de VDO.Ninja (postMessage).
// Eventos documentados: "view-connection" (value true/false, streamID). "end-view-connection" se acepta por si existe.
// Si el evento no llega, el operador puede marcar la cámara a mano desde /control.

export const roomOf = (url) => {
  try { return new URL(url).searchParams.get('view'); } catch { return null; }
};

export function statusFromMessage(event, sources) {
  if (event?.origin !== 'https://vdo.ninja') return null;
  const d = event.data;
  if (!d || typeof d !== 'object') return null;
  let status;
  if (d.action === 'view-connection') status = d.value === false ? 'nosignal' : 'live';
  else if (d.action === 'end-view-connection') status = 'nosignal';
  else return null;
  const src = sources.find((s) => s.url && roomOf(s.url) === d.streamID);
  return src ? { id: src.id, status } : null;
}
