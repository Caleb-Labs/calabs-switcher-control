// Mensaje listo para pegar en Discord/WhatsApp con los dos métodos para transmitir.
export function playerMessage(link) {
  const pass = link.password ? `\nContraseña del torneo (por si te la piden): ${link.password}\n` : '';
  return `¡Hola! Así transmites tu juego al torneo (${link.label}):

Opción A — desde el navegador (la más simple)
1) Abre este link en Chrome o Edge: ${link.browser}
2) Elige compartir tu pantalla o la ventana de Sea of Thieves. Para que se escuche el juego marca "Compartir audio del sistema/pestaña" (si compartes solo una ventana, normalmente no sale audio).
3) Deja esa pestaña abierta durante todo el torneo.

Opción B — con OBS (mejor calidad)
1) En OBS arma tu escena del juego y pulsa "Iniciar cámara virtual".
2) Abre este link: ${link.vcam}
3) Elige como cámara "OBS Virtual Camera". Para el audio elige tu micrófono o un cable de audio virtual (por ejemplo VB-Cable) con el sonido del juego.
4) Deja esa pestaña abierta durante todo el torneo.
${pass}
Si algo no conecta, avísame antes de empezar.`;
}

// Sala aleatoria (difícil de adivinar) para una cámara.
export function randomRoom(prefix = 'sot') {
  const bytes = new Uint8Array(8);
  (globalThis.crypto ?? { getRandomValues: (a) => a.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(bytes);
  return `${prefix}-${[...bytes].map((b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')}`;
}
