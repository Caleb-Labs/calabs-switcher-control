// Lectura del marcador desde Google Sheets (API v4, clave de API). El rango NO incluye la fila de títulos.

export const clampInterval = (ms) => Math.min(5000, Math.max(2000, Number(ms) || 3000));

export function sheetUrl({ id, range, apiKey }) {
  const u = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${range}`);
  u.searchParams.set('key', apiKey);
  return u.toString();
}

export function parseRows(values) {
  if (!Array.isArray(values)) return [];
  const teams = [];
  for (const row of values) {
    const name = Array.isArray(row) ? String(row[0] ?? '').trim() : '';
    if (!name) continue;
    const points = Number(row[1]);
    const position = Number(row[2]);
    teams.push({
      name,
      points: Number.isFinite(points) ? points : 0,
      position: Number.isInteger(position) && position > 0 ? position : teams.length + 1,
    });
  }
  return teams;
}

export function startSheetPoller({ sheet, fetchFn = fetch, onUpdate, onStale, intervalMs = 3000, timeoutMs = 4000, autoStart = true }) {
  let stopped = false;
  let timer = null;

  async function tick() {
    // Sin timeout, una conexión colgada deja datos viejos como "frescos" hasta ~5 min.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchFn(sheetUrl(sheet), { signal: ctl.signal });
      if (!res.ok) return onStale();
      const body = await res.json();
      const teams = parseRows(body?.values);
      if (!teams.length) return onStale(); // hoja vacía/ilegible: se conserva el último dato bueno
      onUpdate(teams);
    } catch {
      onStale();
    } finally {
      clearTimeout(timer);
    }
  }

  async function loop() {
    await tick();
    if (!stopped) timer = setTimeout(loop, clampInterval(intervalMs));
  }
  if (autoStart) loop();

  return { tick, stop: () => { stopped = true; clearTimeout(timer); } };
}
