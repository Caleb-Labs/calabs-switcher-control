// Sube un archivo a la carpeta del VTR (también sirve como fondo de la pantalla dividida). Devuelve el nombre guardado.
export async function uploadFile(file) {
  const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file });
  let body = null;
  try { body = await res.json(); } catch { /* respuesta sin JSON */ }
  if (!res.ok || !body?.ok) throw new Error(body?.error ?? `error ${res.status}`);
  return body.name;
}
