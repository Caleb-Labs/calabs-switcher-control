// Links de VDO.Ninja (parámetros: push, view, quality, videobitrate, cleanoutput) y del player de Twitch.
const VDO = 'https://vdo.ninja/';

export function pushLink(team) {
  const u = new URL(VDO);
  u.searchParams.set('push', team.source.room);
  u.searchParams.set('quality', '1'); // 720p
  return u.toString();
}

export function viewLink(team, { bitrate = 3000, noAudio = false } = {}) {
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
  if (noAudio) u.searchParams.set('noaudio', '');
  return u.toString();
}
