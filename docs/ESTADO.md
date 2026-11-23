# Multicam Switcher — Estado del proyecto (para retomar)

Última actualización: 2026-11-22 · Rama: `feat/multicam` · 39 commits · **263 pruebas pasando** (`npm test`)

## 1. La idea
Comunidad de **Sea of Thieves** que hace torneos y los transmite. Los equipos (8 equipos de 2 personas, **un solo jugador por equipo manda la señal**) transmiten su juego y esta aplicación los usa como fuentes de un **"ATEM web"**:
- Multiview con **Preview / Program**, cortes (CUT) y fades.
- **Pantalla dividida** (2 a 9 cámaras) con fondos, GC por recuadro y "peleas" guardadas.
- **GC** (gráficos) con estilos, plantillas, efectos y salida automática; **marcador** desde Google Sheets.
- **VTR** (videos/imágenes), **emergencia** (foto o video), **mezclador de audio**.
- Control con teclado y con un **macropad Redragon SS-552** (10 teclas + 4 diales).
- La salida es la página `/program` (1920×1080) que **OBS carga como Browser Source**; el NDI lo saca OBS (plugin DistroAV). Esta aplicación **no transmite por sí misma**.

Es una **aplicación web local** (servidor Node + dos páginas), no un programa de escritorio. Se abre como ventana de app con `start.bat` (Edge `--app`).

## 2. Cómo arrancar
1. `start.bat` (crea `config\teams.json` la primera vez; instala dependencias).
2. Panel: `http://localhost:3000/control/` · Salida para OBS: `http://localhost:3000/program/` (Browser Source 1920×1080, 30 fps, "Controlar audio mediante OBS").
3. `npm test` para las pruebas. README.md tiene toda la operación.

## 3. Lo que está hecho
- **Switcher:** estado en servidor (reducer puro `server/state.js`), WebSocket, `/control` y `/program`. Teclas: `Espacio`=CUT, `Enter`=FADE, `1`–`9` cámaras, `0` VTR, `s` dividida. Fade con duración ajustable (slider + comandos de dial) y animación visible en panel y `/program`. Si la misma cámara está en Preview y Program, Preview abre un 2.º iframe (mirror).
- **Cámaras:** 8 equipos + **cámara aérea** (cam9, cuenta como una más), nombres personalizados (doble clic), selector "Equipos [N]" (1–9, la aérea cuenta como una más) que oculta las sobrantes, "sin señal" manual (⚠) y detección por evento de VDO.Ninja (sin verificar).
- **Conexión (VDO.Ninja):** panel con contraseña única, calidad 1080p/720p, FPS 30/60, sala por cámara (editable, aleatorias), "Link navegador", "Link OBS" y mensaje para el jugador. Cambiar sala/contraseña reconecta las cámaras solas.
- **Pantalla dividida:** fuente virtual `split`; elegir cámaras con botones (1–9), posiciones con nombre, arrastrar/redimensionar recuadros, fondos por cantidad (subir imagen, molde PNG con medidas en píxeles), GC por recuadro (texto, posición, estado preview/live), audio por recuadro (suena solo mientras está al aire), peleas guardadas (incluyen textos/posiciones/audio).
- **GC:** texto libre, mover arrastrando, **estilos** por tipo (pantalla única / dividida / marcador): colores, opacidad, tamaño, plantilla PNG (620×120), efectos de entrada/salida, "se baja solo a los N segundos", vista previa en vivo.
- **VTR / emergencia:** subir archivos desde el panel, fader de volumen, cartel cuando no hay archivo; emergencia con foto o video.
- **Audio:** faders por cámara, mezclador, nivel general, VTR; botón "Probar audio (bip)"; estado del audio del VTR.
- **Macropad:** `POST /api/do/<comando>` (`macropad\cmd.bat`) y teclas extra. Propuesta de asignación de diales en el README. **Falta configurarlo en Redragon Station.**
- **Zona segura:** casilla en la barra; guías solo en el monitor de Preview.
- **Seguridad básica:** servidor solo en 127.0.0.1, chequeo de Origin (WS y API), subidas con lista blanca/tamaño máximo, SVG sandbox, textos de Sheets siempre como texto (no HTML).
- **Persistencia:** `data/split.json` (pantalla dividida, peleas, posiciones y estilos de GC, nombres, cantidad, emergencia, conexión). Variable `SPLIT_FILE` para otro archivo.

## 4. Decisiones del usuario (no reabrir sin preguntar)
- OBS solo sirve para sacar el programa; casters van en OBS. Gráficos y switcher dentro de la app.
- Entrada: VDO.Ninja dentro de la app. Dos formas de transmitir por cámara: **navegador (compartir pantalla)** y **OBS cámara virtual**. Contraseña **única por torneo**; cada cámara con su propio link.
- Calidad objetivo **1080p a 30 fps** (perfil `1080p30`, ahora por defecto).
- Marcador y tabla desde **Google Sheets**. Tabla a pantalla completa sale por el VTR.
- Tema oscuro con colores apagados.
- Replay de jugadas: **futuro** (idea: buffer de los últimos minutos por cámara).

## 5. Hallazgos técnicos importantes
- **WHIP de OBS → VDO.Ninja solo admite 1 espectador**; la app abre varias conexiones por cámara → **no usar WHIP**, usar cámara virtual.
- Compartir *una ventana* en VDO.Ninja normalmente **no incluye audio**: el jugador debe compartir audio del sistema/pestaña o usar micrófono/cable virtual.
- Los gráficos se escalan como **un solo lienzo 1920×1080** (antes las posiciones no escalaban y los GC salían fuera de las ventanas del panel).
- Los tests de DOM usan `linkedom` (jsdom tardaba 41 s en el disco E: por WSL).
- Cada cámara con audio encendido, la del preview y las de la dividida son **conexiones extra** del jugador hacia `/program`.

## 6. Pendiente / próximos pasos (por prioridad)
0. **Bloque en curso (pedido del usuario, 2026-11-22):**
   - ✅ Selector **Equipos [N]** (1–9): la aérea (cam9) cuenta como una cámara más; se quitó la casilla "aérea" y `SET_AERIAL`. Los archivos viejos con `aerialOn` se migran solos. La barra superior ahora baja de línea (antes Equipos quedaba cortado y el usuario no lo veía).
   - ✅ **Zona segura en Preview** (casilla en la barra; acción 93 %, título 90 %, cruz central; solo Preview, nunca `/program`). Verificada en Edge real; **falta que el usuario la vea en su ventana** (dijo que no le salía; se añadió `cache-control: no-store` y requiere reiniciar el servidor).
   - ✅ **VTR sincronizado** (bug reportado por el usuario: en el panel Program/Preview iban en otro punto que OBS): el servidor lleva un reloj (`vtr.pos`/`vtr.since`, acción `VTR_ENDED` al terminar; la hora la pone el servidor) y cada copia (panel, Preview espejo, `/program`) salta al punto del reloj si se desvía >0,35 s, revisando cada segundo. Verificado en Edge real: las 3 copias dentro de 0,07 s y en pausa paran en el mismo segundo. (En pestañas en segundo plano el navegador frena el reloj; en OBS no pasa.)
   - ✅ **Perfil `1080p30-tiles-ligeros`** (tiles del panel a 1000 kbps, Program/`/program` a 6000 kbps), activo en el `config/teams.json` del usuario (`"profile"`). Los fps los decide el jugador (30); el que mira no puede pedir menos fps, solo menos bitrate/tamaño. OBS en 30 fps (estaba en 60).
   - ✅ **Regla de salas sin guiones** (hallazgo del usuario, confirmado en Edge real): VDO.Ninja cambia todo lo que no sea letra/número/`_` por `_` en el nombre de la sala (`replace(/[\W]+/g,"_")`), así que con `-` el emisor entraba como `sot_torneo_eq1` y el panel miraba `sot-torneo-eq1` y nunca coincidían (sin error). Ahora: `public/shared/room.js` (`isValidRoom`, `cleanRoomInput`), `CONN_ROOM(S)` rechazan guiones, el panel convierte lo que se escribe a `_`, `randomRoom()` ya no lleva guion, la sala en `teams.json` puede ir **en blanco** (cámara "SIN SALA", sin links hasta escribirla) y las salas guardadas con guion se descartan al cargar. `teams.example.json` y el `teams.json` del usuario quedaron con las salas en blanco.
   - ✅ **Rediseño tipo ATEM, paso 1** (pedido del usuario; él va dictando los siguientes pasos, **no cambiar el diseño sin que lo pida**): barra de pestañas fija abajo (`public/control/tabs.js`, la pestaña se recuerda en el navegador) con Mezclador · Cámaras en pantalla · Conexión · Audio · Multimedia · GC y ⚙ Ajustes a la izquierda; naranja apagado (`--tab`) para la activa. Arriba, siempre visibles: multiview, CUT/FADE/Duración y el botón **EMERGENCIA** fijo (parpadea al estar activa). Cada sección se movió a su pestaña sin cambiar sus ids. La pestaña Mezclador es un marcador de posición para los stingers.
   - ⏳ **Siguiente (ya hablado con el usuario):** contador del VTR (transcurrido/total/que falta, aviso en los últimos segundos), casilla «Repetir» y sonido opcional en la emergencia (hoy el video de emergencia siempre repite y va mudo), botón de subida propio en la emergencia. Preguntas abiertas en el chat: formato del contador y dónde mostrarlo.
   - ⏳ **Stinger** (transición propia): subir un WebM con alfa, elegir a mano el segundo de corte (ej. video de 10 s, cambio a los 5 s), el audio del video suena, varios cargados y elegibles; CUT y FADE se mantienen. Se reproduce en `/program` sobre el Program.
   - ✅ **Medidores de audio** (barra vertical semitransparente, con pico) en cada ventana del multiview, VTR incluido; `/program` limpio. Cámaras: `postMessage {action:'loudness'}` de VDO.Ninja (los tiles del panel usan `mutespeaker`+`getloudness`; **`noaudio` impide medir**). VTR: analizador de Web Audio (un video `muted`/`volume 0` da nivel 0, por eso va sin silenciar pero solo al analizador). Verificado en Edge real con emisor falso. **Falta calibrar la escala (`FULL=60` en `public/shared/meter.js`) con el audio real del juego.**
1. **Prueba real con 2–3 jugadores:** conexión por navegador y por OBS, links del panel, contraseña, 1080p30.
2. **Medición de rendimiento** con 8–9 emisores (Ryzen 5 3600 / RTX 3060): instrucciones en `docs/superpowers/notes/perf-spike.md`. Si no aguanta: bajar a `720p`/`480p-tiles` o pasar a app de escritorio.
3. **Audio en OBS:** botón "Probar audio (bip)", VTR en Program + ▶, y que VDO.Ninja obedezca el comando `{volume}` por iframe (sin verificar). Activar "Controlar audio mediante OBS" y Monitoreo de audio.
4. **Verificar en vivo:** evento `view-connection` (caída de cámara), efectos de GC, salida automática, fade en movimiento, dividida con video real.
5. **Marcador:** probar con Google Sheets (pasos en README). Opcional: **modo de prueba local** (editor de puntos en el panel).
6. **Macropad:** ver si Redragon Station permite "ejecutar programa" (`macropad\cmd.bat`) o solo teclas; asignar diales.
7. **Revisión de código** del último bloque grande (conexión, estilos, audio de dividida, cámaras visibles) con `/code-review`; solo el bloque anterior pasó por un revisor independiente.
8. Opcionales: QR para la cámara aérea (celular), botón para borrar archivos subidos, replay, preguntar si el NDI debe ser distinto de la interpretación actual (lo saca OBS).
9. Menores sin resolver: reintento si falla `/api/sources`, rango de Sheets sin codificar en URL, números con formato regional, nombre largo sobre el logo en el GC de nombre.

## 7. Reglas de trabajo (importante)
- **Nunca borrar `data/split.json`** (son los datos reales del usuario). Para probar usar `SPLIT_FILE=/tmp/algo.json`.
- No matar procesos por patrón (puede cerrar el servidor del usuario); usar archivos de PID propios.
- Los módulos que se prueban en Node usan imports **relativos**; los de solo navegador pueden usar `/ruta` absoluta.
- Flujo: pruebas primero (TDD) → implementar → `npm test` → commit. El archivo `.superpowers/` (ignorado por git) guarda el registro de decisiones y *rulings*.
- El usuario habla español; responder en español y avisar antes de cambios grandes ("no hagas nada hasta que yo te diga" si lo pide).

## 8. Mapa de archivos
- `server/` — `state.js` (reducer y persistencia), `index.js` (HTTP+WS+guardado+auto-ocultar), `api.js` (sources, links, teams, comando), `commands.js`, `upload.js`, `vtr.js`, `sheets.js`, `links.js`, `autohide.js`, `config.js`, `profiles.js`, `main.js`.
- `public/control/` — panel (control.js, splitpanel.js, mixer.js, connpanel.js, gcstylepanel.js, gcmove.js, mold.js, messages.js…).
- `public/program/` — salida para OBS. `public/shared/` — lógica común (sources, split, gcstyle, vtr, client). `public/graphics/` — plantillas, capa de GC, CSS/efectos.
- `config/` — `teams.json` (del usuario, ignorado por git), `teams.example.json`, `profiles.json`, `sheet-template.csv`. `vtr/` — archivos subidos (ignorado). `data/` — persistencia (ignorado). `macropad/cmd.bat`.
- `docs/superpowers/` — diseño (`specs/`), plan (`plans/`), medición (`notes/`). `tests/` — 225 pruebas.
