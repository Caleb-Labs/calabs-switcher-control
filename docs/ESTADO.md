# CaLabs Switcher Control — Estado del proyecto (para retomar)

Última actualización: 2026-11-23 · Rama: `feat/multicam` · **297 pruebas pasando** (`npm test`) · Operación completa en `docs/MANUAL.md`.

> Nombre del proyecto: **CaLabs Switcher Control** (antes «Multicam Switcher»). Nombre técnico: **web video switcher / vision mixer** (en español: mezclador / switcher de video; el oficio es «realización»). Repositorio propuesto: `Caleb-Labs/calabs-switcher-control` (ver §8).

## 1. La idea
Comunidad de **Sea of Thieves** que hace torneos y los transmite. Los equipos (8 equipos de 2 personas, **un solo jugador por equipo manda la señal**) transmiten su juego y esta aplicación los usa como fuentes de un switcher de video web (estilo ATEM):
- Multiview con **Preview / Program**, cortes (CUT) y fades.
- **Pantalla dividida** (2 a 9 cámaras) con fondos, GC por recuadro y «peleas» guardadas.
- **GC** con estilos, plantillas, efectos y salida automática; **marcador** desde Google Sheets.
- **VTR** (videos/imágenes con contador), **emergencia** (foto o video), **mezclador de audio** con **medidores** en cada fuente.
- Control con teclado y con un **macropad Redragon SS-552** (10 teclas + 4 diales) mediante un plugin.
- La salida es la página `/program` (1920×1080) que **OBS carga como Browser Source**; el NDI lo saca OBS (plugin DistroAV). Esta aplicación **no transmite por sí misma**.

Es una **aplicación web local** (servidor Node + dos páginas), no un programa de escritorio. Se abre como ventana de app con `start.bat` (Edge `--app`).

## 2. Cómo arrancar
1. `start.bat` (crea `config\teams.json` la primera vez; instala dependencias).
2. Panel: `http://localhost:3000/control/` · Salida para OBS: `http://localhost:3000/program/` (Browser Source 1920×1080, **30 fps**, «Controlar audio mediante OBS»).
3. `npm test` para las pruebas. `npm run botones` regenera los lanzadores del macropad; `npm run plugin` reconstruye el plugin.
4. **Tras cambiar código del servidor hay que reiniciar** (cerrar la ventana negra «Multicam server» y abrir `start.bat`) y recargar la ventana de la app con `Ctrl+Shift+R`.

## 3. Lo que está hecho
**Switcher y panel**
- Estado en servidor (reducer puro `server/state.js`), WebSocket, `/control` y `/program`. Teclas: `Espacio`=CUT, `Enter`=FADE, `1`–`9` cámaras, `0` VTR, `s` dividida. Fade con duración ajustable. Si la misma cámara está en Preview y Program, Preview abre un 2.º iframe (espejo).
- **Diseño tipo ATEM, paso 1:** barra de pestañas fija abajo (`public/control/tabs.js`; la pestaña se recuerda en el navegador): Mezclador · Cámaras en pantalla · Conexión · Audio · Multimedia · GC, y ⚙ Ajustes a la izquierda; naranja apagado (`--tab`) para la activa. Arriba, siempre visibles: multiview, CUT/FADE/Duración y el botón **EMERGENCIA** fijo (parpadea al estar activa). La pestaña Mezclador es un marcador de posición para los stingers.
- **Zona segura** en Preview (casilla en Ajustes; acción 93 %, título 90 %, cruz central; nunca en `/program`).
- **Medidores de audio** (barra vertical semitransparente con pico) en cada ventana del multiview, VTR incluido; `/program` limpio.

**Cámaras y conexión (VDO.Ninja)**
- 8 equipos + **cámara aérea** (cam9, cuenta como una más). Selector **Equipos [N]** (1–9) en Ajustes que oculta las sobrantes; nombres personalizados (doble clic); «sin señal» manual (⚠) y detección por evento de VDO.Ninja (sin verificar).
- Panel Conexión: contraseña única, calidad 1080p/720p, FPS 30/60, sala por cámara (editable, aleatorias), «Link navegador», «Link OBS», mensaje para el jugador. Cambiar sala/contraseña reconecta las cámaras solas.
- **Salas sin guiones** (solo letras, números y `_`; `public/shared/room.js`). Una sala en blanco = cámara «SIN SALA» sin links. Las salas guardadas con guion se descartan al cargar.
- Perfil de calidad `1080p30-tiles-ligeros` (tiles del panel a 1000 kbps, Program a 6000 kbps), activo en el `config/teams.json` del usuario.

**VTR y emergencia**
- VTR con **reloj compartido** (`vtr.pos`/`vtr.since`, acción `VTR_ENDED`): panel, espejo y `/program` van en el mismo segundo (verificado: 0,07 s).
- **Contador** `-02:28 / 03:10` (lo que falta / total) sobre la ventana del VTR y grande en Multimedia; parpadea en rojo en los últimos 10 s; en pausa se queda quieto. Sin barra de progreso. Lógica en `public/shared/vtrcount.js`.
- Emergencia con foto o video (hoy el video siempre repite y va mudo).

**Pantalla dividida, GC, audio**
- Split 2–9 cámaras: botones, posiciones, arrastrar/redimensionar, fondos por cantidad (molde PNG), GC por recuadro, audio por recuadro, peleas guardadas.
- GC: texto libre, mover arrastrando, estilos por tipo (colores, opacidad, tamaño, plantilla PNG 620×120, efectos, «se baja solo»), marcador desde Google Sheets.
- Mezclador: faders por cámara y VTR, nivel general, «Probar audio (bip)».

**Macropad (Redragon SS-552; software «Stream Station» = HotSpot StreamDock)**
- `POST /api/do/<comando>` (50 comandos en `server/commands.js`), `macropad/cmd.bat`, un `.bat` y un `.vbs` sin ventana por comando en `macropad/botones/`.
- **Plugin `.sdPlugin`** (`macropad/plugin/`, paquete en `macropad/plugin/dist/com.multicam.control.sdPlugin`): acción de tecla «Comando Multicam» (desplegable en español) y acción de rueda «Dial Multicam» (girar → / girar ← / presionar). **Confirmado por el usuario con su macropad real: el corte y los diales funcionan perfecto.**

**Seguridad básica:** servidor solo en 127.0.0.1, chequeo de Origin (WS y API), subidas con lista blanca/tamaño, SVG sandbox, textos de Sheets como texto. **Persistencia:** `data/split.json` (variable `SPLIT_FILE` para otro archivo).

## 4. Decisiones del usuario (no reabrir sin preguntar)
- OBS solo sirve para sacar el programa; casters van en OBS. Gráficos y switcher dentro de la app.
- Entrada: VDO.Ninja. Dos formas de transmitir por cámara: **navegador (compartir pantalla)** y **OBS cámara virtual**. Contraseña **única por torneo**; cada cámara con su propio link.
- Calidad objetivo **1080p30**; OBS también a 30 fps. Marcador y tabla desde **Google Sheets**. Tema oscuro con colores apagados. Replay: futuro.
- La aérea es **una cámara más** (no tiene interruptor aparte); el selector cuenta de 1 a 9.
- **Rediseño estilo ATEM:** él va dictando los pasos; **no cambiar el diseño sin que lo pida**. La **emergencia siempre a mano** (botón fijo arriba).
- **Contador del VTR:** formato `-02:28 / 03:10`, bien visible como los medidores, parpadeo rojo en los últimos 10 s, en pausa se congela y debe coincidir con OBS; **sin barra de progreso**.
- **Medidores de audio** en cada fuente (VTR incluido); `/program` limpio.
- **Stinger** (aún por hacer): WebM con transparencia, él elige a mano el segundo del corte (ej. video de 10 s, cambio a los 5 s), el audio del video suena, varios cargados y elegibles; CUT y FADE se mantienen.
- **Emergencia** (aún por hacer): poder subir video y dejarlo con opción de **repetir (loop)**.

## 5. Hallazgos técnicos importantes
- **WHIP de OBS → VDO.Ninja solo admite 1 espectador**: usar cámara virtual, no WHIP.
- Compartir *una ventana* en VDO.Ninja normalmente **no incluye audio**: compartir audio del sistema/pestaña o usar micrófono/cable virtual.
- **VDO.Ninja cambia todo lo que no sea letra/número/`_` por `_` en la sala** (`replace(/[\W]+/g,"_")`): con un guion el emisor entraba como `sot_torneo_eq1` y el panel miraba `sot-torneo-eq1` y **nunca coincidían, sin error**. Hallazgo del usuario, confirmado en Edge real.
- **VDO.Ninja pregunta «Would you like to load your previous session?»** si el navegador guardó una sesión: hay que pulsar **Cancel** (con OK redirige a la sala vieja y se pierde sala, contraseña y calidad).
- Si la contraseña del panel y la del link del jugador no coinciden no se conectan **y no sale ningún error**; los links viejos no sirven tras cambiar contraseña/salas.
- **`&noaudio` impide medir el audio** (el iframe no recibe pista); los tiles del panel usan `&mutespeaker&getloudness` y VDO.Ninja manda `{action:'loudness', loudness:{<streamID>: nivel}}`. Un `<video>` con `muted` o `volume 0` da nivel 0 en un analizador de Web Audio: el VTR va sin silenciar pero conectado solo al analizador.
- Los gráficos se escalan como **un solo lienzo 1920×1080**. Los tests de DOM usan `linkedom`. Cada cámara con audio encendido, la del preview y las de la dividida son conexiones extra del jugador hacia `/program`.
- El que mira no puede pedir menos fps (los decide el jugador); solo menos bitrate/tamaño.
- **Stream Station** (Redragon/HotSpot StreamDock; instalado en una carpeta del disco E:): plugins en `AppData\Roaming\HotSpot\StreamDock\plugins`, logs en `...\StreamDock\logs\log-*.txt` (línea «Plugin … is now connected»), los plugins se lanzan **solo al arrancar** (hay que reiniciarlo tras instalar uno) y **no trae Node**: los plugins de Node entran por un `.cmd` lanzador (`bin/lanzador.cmd` busca un `node.exe`). Llama **«Knob»** a las ruedas (Elgato: «Encoder»). «Abrir una aplicación» solo lista apps instaladas.
- Un navegador en segundo plano frena los temporizadores y el reloj de video: para medir/capturar, la pestaña debe estar al frente.

## 6. Pendiente / próximos pasos (por prioridad)
1. **Stinger** (ver §4): subir WebM con alfa, punto de corte elegible, audio, varios elegibles; se reproduce en `/program` sobre el Program. Es lo único que falta de lo pedido al inicio.
2. **Emergencia:** casilla «Repetir», sonido opcional y botón de subida propio.
3. **Rediseño estilo ATEM:** seguir paso a paso cuando el usuario diga.
4. **Prueba real con 2–3 jugadores a la vez** (hoy solo se probó 1 de punta a punta) y **medición de rendimiento con 8–9 emisores** (Ryzen 5 3600 / RTX 3060; `docs/superpowers/notes/perf-spike.md`). Si no aguanta: perfil más liviano o app de escritorio.
5. **Calibrar los medidores** con audio real del juego (`FULL=60` en `public/shared/meter.js`) y verificar el audio/volumen en OBS («Controlar audio mediante OBS», que VDO.Ninja obedezca `{volume}` por iframe).
6. **Verificar en vivo:** evento `view-connection` (caída de cámara), efectos de GC, salida automática, fade en movimiento, dividida con video real.
7. **Marcador:** probar con Google Sheets (pasos en el manual). Opcional: modo de prueba local.
8. **Macropad:** asignar el resto de teclas y ruedas (tabla propuesta en el manual). Opcional: estado en la tecla (EMERGENCIA en rojo) escuchando el WebSocket de la app.
9. **Revisión de código** con `/code-review` de los bloques grandes recientes.
10. Opcionales: QR para la cámara aérea (celular), borrar archivos subidos, replay, interfaz en inglés. Menores: reintento si falla `/api/sources`, rango de Sheets sin codificar en URL, números con formato regional, nombre largo sobre el logo en el GC de nombre, las guías de zona segura tapan la etiqueta «PREVIEW».

## 7. Reglas de trabajo (importante)
- **Nunca borrar `data/split.json`** (son los datos reales del usuario). Para probar usar `SPLIT_FILE=<copia o archivo temporal>`.
- **No matar procesos por patrón**: usar archivos de PID propios o buscar por carpeta de trabajo (`/proc/*/cwd`); no tocar el servidor ni el Stream Station del usuario. Limpiar siempre lo que se abre para probar (servidor, Edge de prueba, archivos en `C:\Windows\Temp\mc*`).
- Flujo: pruebas primero (TDD) → implementar → `npm test` → commit.
- El usuario habla español; responder en español. **Avisar antes de cambios grandes y no tocar el diseño sin que lo pida.** Dar **instrucciones concretas** (en qué ventana está y adónde ir, paso a paso); su Edge está en español (`permitir pegar`). Mejor reproducir yo en un Edge real que pedirle pruebas en la consola.
- **Acciones hacia afuera (publicar en GitHub, etc.) se confirman primero** con el usuario.
- **Cómo probar en un navegador real desde WSL:** Edge de Windows en modo oculto (`--headless=new --remote-debugging-port=N --user-data-dir=C:\Windows\Temp\...`, con `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` para emisores falsos y `--use-file-for-fake-video-capture=<.y4m>` para video propio) y un script CDP ejecutado con `cmd.exe /c node` (Node de Windows trae `WebSocket` y `fetch`). Windows tarda ~3 s en «ver» un puerto recién abierto en WSL. «Abrir/ejecutar» desde WSL: usar PowerShell para rutas con espacios.
- Los módulos que se prueban en Node usan imports **relativos**; los de solo navegador pueden usar `/ruta` absoluta. `.superpowers/` (ignorado por git) guarda el registro de decisiones.

## 8. Publicación en GitHub (preparada, NO publicada)
El usuario quiere subirlo como **«CaLabs - Switcher control»** con un README «wapo» como su publicación anterior (**`Caleb-Labs/calabs-playout`**, pública: logo, texto en inglés y español, qué hace hoy, hoja de ruta con lo hecho tachado y lo que falta, sección de seguridad y datos, **«Creado con IA — Co-creado con Claude (Anthropic)»** y pie «Made with 💙 and 🤖 AI by CaLabs · All rights reserved»).
- **Hecho en local (sin subir nada):** `README.md` bilingüe en ese estilo, `Logos/` (los mismos logos de su repo anterior), `docs/capturas/` (5 capturas del panel con una **demo con datos inventados**: cámaras de paisajes marinos dibujados por código, equipos «Los Piratas/Capitanes/Kraken/Sirenas»; no se usaron datos ni videos del usuario), el manual movido a `docs/MANUAL.md`, paquete renombrado a `calabs-switcher-control`. Revisión de privacidad: **sin secretos ni claves**; se quitó una ruta personal de este documento; `config/teams.json`, `data/` y `vtr/` van en `.gitignore`. Los commits llevan el mismo correo que ya muestra su repo anterior.
- **`gh` está en Windows** (`C:\Program Files\GitHub CLI\gh.exe`, sesión iniciada como `Caleb-Labs`, permisos `repo`); no está instalado en WSL.
- **Falta que el usuario decida y avise («te aviso para subirlo»):** (a) nombre del repo (propuesta `calabs-switcher-control`), (b) **público o privado**, (c) **publicar el código fuente o solo documentación/capturas** (en `calabs-playout` retiró el código fuente), (d) licencia (su repo anterior no tiene archivo LICENSE: «All rights reserved»), (e) topics y descripción (propuestos: `video-switcher`, `vision-mixer`, `live-production`, `multiviewer`, `webrtc`, `vdo-ninja`, `obs`, `broadcast`, `esports`, `nodejs`). Antes de subir: revisar el historial con `git log`, confirmar el listado de archivos con `git ls-files` y crear el repo desde `gh.exe`.

## 9. Mapa de archivos
- `server/` — `state.js` (reducer y persistencia), `index.js` (HTTP+WS+guardado+auto-ocultar), `api.js` (sources, links, teams, comando), `commands.js`, `upload.js`, `vtr.js`, `sheets.js`, `links.js`, `autohide.js`, `config.js`, `profiles.js`, `main.js`.
- `public/control/` — panel (`control.js`, `tabs.js`, `meters.js`, `splitpanel.js`, `mixer.js`, `connpanel.js`, `gcstylepanel.js`, `gcmove.js`, `mold.js`, `messages.js`…).
- `public/program/` — salida para OBS. `public/shared/` — lógica común (`sources`, `split`, `gcstyle`, `vtr`, `vtrcount`, `meter`, `room`, `signal`, `client`). `public/graphics/` — plantillas, capa de GC, CSS/efectos.
- `config/` — `teams.json` (del usuario, ignorado), `teams.example.json` (salas en blanco), `profiles.json`, `sheet-template.csv`. `vtr/` (ignorado). `data/` (ignorado).
- `macropad/` — `cmd.bat`, `botones/` (un `.bat` y un `.vbs` por comando), `generar-botones.js`, `plugin/` (`etiquetas.js`, `build.js`, `fuente/com.multicam.control.sdPlugin/`, `dist/`).
- `Logos/` y `docs/capturas/` — material del README. `docs/MANUAL.md` — manual de operación. `docs/superpowers/` — diseño (`specs/`), plan (`plans/`), medición (`notes/`). `tests/` — 297 pruebas.

## 10. Registro de lo conversado (sesión 2026-11-22 y 23)
1. **Cámaras ocultas:** el selector «Equipos» existía pero la barra no bajaba de línea y quedaba cortado; se arregló. Luego la aérea pasó a contar como una cámara más (1–9).
2. **Medidores de audio** en cada fuente y **zona segura** en Preview (pedidos al inicio, estilo ATEM); transiciones propias (stinger) quedaron planificadas pero **no hechas**.
3. **VTR desincronizado** entre panel y OBS → reloj compartido. **Contador** del VTR.
4. **Rendimiento:** perfil `1080p30-tiles-ligeros`; OBS a 30 fps.
5. **Primera conexión real:** salas con guion (hallazgo del usuario), sesión previa de VDO.Ninja, contraseña vacía vs. link con contraseña → regla de salas sin guiones y estado «SIN SALA».
6. **Rediseño tipo ATEM** paso 1 (barra de pestañas) y **emergencia siempre a mano**.
7. **Macropad:** lanzadores `.bat`/`.vbs` y plugin para Stream Station (descubierto que no trae Node → lanzador `.cmd`; las ruedas son «Knob»). Teclas y diales **confirmados** en el equipo real.
8. **GitHub:** nombre técnico del software, nombre del proyecto «CaLabs - Switcher control», README bilingüe con logo y nota de IA, capturas con demo; pendiente el aviso del usuario para subirlo.
