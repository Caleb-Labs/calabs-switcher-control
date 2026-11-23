import { playerMessage, randomRoom } from './messages.js';
import { cleanRoomInput } from '/shared/room.js';

const $ = (id) => document.getElementById(id);

// Panel "Conexión de cámaras": salas, contraseña única, calidad y links/mensajes para cada jugador.
export function initConnPanel({ send }) {
  let state = null;
  let lastKey = null;
  let links = [];

  const savePass = () => send({ type: 'CONN_SET', password: $('cn-pass').value.trim() });
  $('cn-pass-save').onclick = savePass;
  $('cn-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); savePass(); } });
  $('cn-quality').onchange = (e) => { send({ type: 'CONN_SET', quality: e.target.value }); e.target.blur(); };
  $('cn-fps').onchange = (e) => { send({ type: 'CONN_SET', fps: Number(e.target.value) }); e.target.blur(); };
  $('cn-random').onclick = () => {
    if (!confirm('Esto cambia las salas de TODAS las cámaras: tendrás que volver a enviar los links. ¿Continuar?')) return;
    send({ type: 'CONN_ROOMS', rooms: Object.fromEntries(links.filter((l) => l.kind === 'vdo').map((l) => [l.id, randomRoom()])) });
  };

  const copy = async (text, btn) => {
    try { await navigator.clipboard.writeText(text); const t = btn.textContent; btn.textContent = '¡Copiado!'; setTimeout(() => { btn.textContent = t; }, 1200); }
    catch { window.prompt('Copia con Ctrl+C:', text); }
  };

  function renderRows() {
    const box = $('cn-rows');
    box.replaceChildren(...links.map((l) => {
      const row = document.createElement('div'); row.className = 'cn-row';
      const name = document.createElement('strong'); name.textContent = l.label;
      row.append(name);
      if (l.kind !== 'vdo') { const t = document.createElement('span'); t.textContent = `Twitch: ${l.channel ?? ''}`; row.append(t); return row; }
      const room = document.createElement('input'); room.type = 'text'; room.value = l.room; room.maxLength = 50;
      room.placeholder = 'escribe la sala'; room.title = 'Sala de esta cámara: solo letras, números y _ (VDO.Ninja cambia el resto por _, y la sala dejaría de coincidir)';
      room.onchange = () => {
        const v = cleanRoomInput(room.value); // lo no permitido (guiones, espacios, acentos) pasa a _
        room.value = v;
        if (v.length >= 3 && v !== l.room) send({ type: 'CONN_ROOM', id: l.id, room: v });
      };
      const mk = (text, fn) => { const b = document.createElement('button'); b.textContent = text; b.onclick = () => fn(b); b.disabled = !l.room; if (!l.room) b.title = 'Primero escribe la sala de esta cámara'; return b; };
      row.append(room,
        mk('Link navegador', (b) => copy(l.browser, b)),
        mk('Link OBS', (b) => copy(l.vcam, b)),
        mk('Mensaje para el jugador', (b) => copy(playerMessage(l), b)));
      return row;
    }));
  }

  async function refresh() {
    try { links = await (await fetch('/api/links')).json(); renderRows(); } catch { /* sin servidor: se reintenta en el siguiente estado */ }
  }

  return {
    render(s) {
      state = s;
      if (document.activeElement !== $('cn-pass')) $('cn-pass').value = s.conn.password;
      $('cn-quality').value = s.conn.quality;
      $('cn-fps').value = String(s.conn.fps);
      const key = JSON.stringify([s.connRev, s.sources.filter((x) => x.active).map((x) => x.id + x.label)]);
      if (key !== lastKey) { lastKey = key; refresh(); }
    },
  };
}
