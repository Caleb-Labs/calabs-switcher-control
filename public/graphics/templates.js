// Plantillas de gráficos (diseño base 1920x1080). Todo texto entra con textContent:
// los nombres vienen de Google Sheets y no son de confianza.

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

const sortedTeams = (data) =>
  [...(data?.teams ?? [])].sort((a, b) => (Number(a.position) || 999) - (Number(b.position) || 999));

function table(cls, data) {
  const root = el('div', `g-root ${cls}`);
  if (data?.full) root.classList.add('full');
  for (const t of sortedTeams(data)) {
    const row = el('div', 'row');
    row.append(el('span', 'pos', String(t.position ?? '')), el('span', 'name ellipsis', String(t.name ?? '')), el('span', 'pts', String(t.points ?? 0)));
    root.append(row);
  }
  return root;
}

const TEMPLATES = {
  'gc-name': (d) => {
    const root = el('div', 'g-root gc-name');
    if (d.logo) { const img = el('img', 'logo'); img.setAttribute('src', d.logo); root.append(img); }
    root.append(el('div', 'team ellipsis', String(d.team ?? '')), el('div', 'player ellipsis', String(d.player ?? '')));
    return root;
  },
  scoreboard: (d) => table('scoreboard', d),
  standings: (d) => table('standings', d),
  nosignal: () => el('div', 'g-root nosignal', 'SIN SEÑAL'),
  emergency: (d) => {
    const root = el('div', 'g-root emergency');
    if (d.logo) { const img = el('img', 'logo'); img.setAttribute('src', d.logo); root.append(img); }
    else root.append(el('div', 'fallback', 'VOLVEMOS EN UN MOMENTO'));
    return root;
  },
};

export function renderGraphic(template, data = {}) {
  const make = TEMPLATES[template];
  if (!make) throw new Error(`plantilla desconocida: ${template}`);
  return make(data ?? {});
}
