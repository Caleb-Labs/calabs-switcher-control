# Stinger (transición propia) — diseño

Fecha: 2026-11-23 · Tamaño: cambio mediano · Estado: **pendiente de aprobación**

## Intención
El usuario quiere **subir las transiciones (stingers) que él quiera y lanzarlas a voluntad**; el cambio de cámara ocurre **en el segundo que él marque** dentro de cada video. CUT y FADE se quedan como están.

## Metas
- Subir varias transiciones y elegir cuál usar.
- Marcar por transición el segundo del corte: barra sobre el video + botón «cortar aquí» + número editable.
- Lanzarla con un botón fijo arriba (junto a CUT/FADE), la tecla `t` y un comando de macropad; actúa como CUT (lo que está en Preview pasa a Program) pero con el video encima.
- El audio del video suena por `/program`.
- El corte coincide con la animación (mismo reloj que el video).

## No-metas
- No se ve el stinger en las ventanas del panel (solo en `/program`); el panel cambia de cámara al corte.
- No hay editor de video, duración ni efectos propios.
- No se toca el diseño existente más allá del botón y la pestaña Mezclador (que ya estaba reservada).

## Anti-metas (sería un fracaso aunque «funcione»)
- Corte desfasado de la animación.
- Quedarse a medias si `/program` no responde.

## Restricciones
- OBS (Chromium) lee **WebM con transparencia (VP8/VP9 alfa)**; **no** `.mov` ProRes ni `.mp4` con alfa. Un `.mp4` opaco sirve. Se avisa en la interfaz.
- Las subidas ya aceptan `.webm/.mp4/.mov` hasta 300 MB (`server/upload.js`) y `/vtr/` sirve con Range.
- Estado único en el servidor (reducer puro `server/state.js`); `/program` no es una fuente de verdad.
- Mantener `data/split.json` compatible: campo nuevo opcional, sin romper datos existentes (**nunca borrarlo**).

## Enfoques considerados
- **A. El video manda (elegido).** El servidor avisa a `/program`; `/program` reproduce y, al llegar al segundo marcado, pide el corte; el servidor hace el TAKE. Exacto. Con **seguro**: si `/program` no responde, el servidor corta solo a `corte + 1,5 s`.
- **B. Temporizador del servidor.** Simple, pero el video tarda en arrancar en OBS y el corte queda desfasado. Descartado.

## Diseño (lo decidido)
**Estado** (`server/state.js`, persistido con `persistable`):
- `stingers: [{ file, cutAt }]` (`cutAt` en segundos, ≥ 0). La lista de archivos sale de la carpeta `vtr/` (como el resto de medios); solo cuentan los registrados.
- `stinger: { selected: file|null }` (elegida) y `stingerRun: null | { seq, file, cutAt, from, to }` (lanzamiento en curso).

**Acciones** (reducer):
- `STINGER_ADD {file}` / `STINGER_REMOVE {file}` / `STINGER_CUT {file, at}` (guarda el segundo; validado número finito ≥ 0) / `STINGER_SELECT {file}`.
- `STINGER_PLAY`: si hay elegida y `preview !== program`, crea `stingerRun` con `seq+1`, `from = program`, `to = preview`; no cambia `program` todavía. Sin elegida o sin diferencia → no hace nada.
- `STINGER_CUT_NOW {seq}` (lo pide `/program` al llegar al segundo, o el seguro del servidor): si `seq` coincide con `stingerRun.seq` y aún no cortó, hace el equivalente a `TAKE` (cut) y marca el run como cortado. Un `seq` viejo o repetido se ignora (idempotente).
- `STINGER_END {seq}`: limpia `stingerRun`.
- `STINGER_CUT_NOW`/`STINGER_END` se aceptan también desde `/program` (se agregan a `CLIENT_ACTIONS` en `server/index.js`).
- Los GC de la dividida se apagan igual que en cualquier TAKE.

**Servidor** (`server/index.js`): temporizador de seguro al lanzar (`cutAt + 1,5 s` → `STINGER_CUT_NOW`; otro a duración máxima → `STINGER_END`); se limpia si llega el aviso a tiempo. Al subir un `.webm`/`.mp4` desde Mezclador se registra con `cutAt` = 0.

**`/program`** (`public/program/`): capa de video por encima de la escena y por debajo de los GC (z-index propio). Precarga oculta la transición elegida (para que arranque sin retraso). Al ver un `stingerRun` nuevo: `currentTime = 0`, `play()` con audio; en `timeupdate`/`requestVideoFrameCallback` cuando `currentTime ≥ cutAt` envía una vez `STINGER_CUT_NOW`; al `ended` envía `STINGER_END` y oculta la capa.

**Panel** (`public/control/`):
- Pestaña **Mezclador**: lista de transiciones (agregar/quitar/elegir) y editor con reproductor sobre fondo cuadriculado, barra, botón «cortar aquí» y número editable (guarda con `STINGER_CUT`).
- Botón **TRANSICIÓN** fijo arriba junto a CUT/FADE; tecla `t` (`keymap.js`); comando de macropad `stinger` (`server/commands.js`, `macropad/plugin/etiquetas.js`).

**Pruebas primero** (TDD): reducer (ADD/CUT/SELECT/PLAY/CUT_NOW idempotente/END, validaciones, persistencia y compatibilidad con datos viejos), temporizador de seguro (con reloj falso), lógica pura del disparo de corte en `/program` (módulo en `public/shared/` con imports relativos), comando y tecla. La parte de video real se verifica a mano en OBS.

## Lo que queda a criterio del constructor
Duración máxima del seguro de fin, nombres de clases CSS, textos de la interfaz, estilo del reproductor, si `requestVideoFrameCallback` o `timeupdate` (se prefiere el primero con respaldo al segundo).
