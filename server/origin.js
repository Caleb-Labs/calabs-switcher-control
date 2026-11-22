// Un navegador siempre manda Origin en peticiones entre sitios. Si viene y no es nuestro propio host, se rechaza
// (evita que otra página abierta en el navegador del operador mande acciones). curl/macropad no mandan Origin.
export function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
