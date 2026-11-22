// Links de VDO.Ninja (parámetros: push, view, quality, videobitrate, cleanoutput) y del player de Twitch.
const VDO = 'https://vdo.ninja/';

const QUALITY = { '1080p': '0', '720p': '1' }; // &quality: 0 = 1080p, 1 = 720p (docs de VDO.Ninja)

// Link que abre el jugador para enviar su juego. mode 'browser': comparte pantalla; 'vcam': usa una cámara (p. ej. la cámara virtual de OBS).
export function pushLink(team, { quality = '720p', fps, password, mode = 'browser' } = {}) {
  const u = new URL(VDO);
  u.searchParams.set('push', team.source.room);
  u.searchParams.set(mode === 'vcam' ? 'webcam' : 'screenshare', '');
  u.searchParams.set('quality', QUALITY[quality] ?? '1');
  if (fps) u.searchParams.set('fps', String(fps));
  if (password) u.searchParams.set('password', password);
  return u.toString();
}

export function viewLink(team, { bitrate = 3000, meter = false, password } = {}) {
  if (team.source.kind === 'twitch') {
    const u = new URL('https://player.twitch.tv/');
    u.searchParams.set('channel', team.source.channel);
    u.searchParams.set('parent', 'localhost');
    u.searchParams.set('muted', 'true');
    return u.toString();
  }
  const u = new URL(VDO);
  u.searchParams.set('view', team.source.room);
  u.searchParams.set('videobitrate', String(bitrate));
  u.searchParams.set('cleanoutput', '');
  // Tiles del panel: altavoz callado pero con audio recibido, y nivel de cada cámara para los medidores (noaudio impediría medir).
  if (meter) { u.searchParams.set('mutespeaker', ''); u.searchParams.set('getloudness', ''); }
  if (password) u.searchParams.set('password', password);
  return u.toString();
}
