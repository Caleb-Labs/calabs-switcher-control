# Multicam Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un switcher web local tipo ATEM: 8 cámaras (VDO.Ninja) + 1 VTR, multiview con Preview/Program, GC con preview, marcador desde Google Sheets, y una salida `/program` 1920×1080 que OBS carga como Browser Source.

**Architecture:** Un servidor Node guarda el estado completo (reducer puro) y lo difunde por WebSocket. `/control` (operador) y `/program` (salida limpia) son páginas estáticas que solo renderizan ese estado y mandan acciones. Las cámaras son iframes de VDO.Ninja; el VTR es un `<video>` local.

**Tech Stack:** Node.js 20+, `ws`, `node:test` + `linkedom` (jsdom tardaba 41 s en cargar en el disco E), HTML/CSS/JS con módulos ES, Google Sheets API v4 (clave de API).

**Spec:** `docs/superpowers/specs/2026-11-21-multicam-switcher-design.md`

## Global Constraints

- 8 cámaras (una por equipo, 8 equipos de 2 personas) + 1 fuente VTR = 9 fuentes; Preview y Program no son fuentes nuevas.
- Páginas: `/control` y `/program`; `/program` es 1920×1080, sin interfaz.
- Cámaras a 720p y ~2–4 Mbps; tiles chicos del multiview a baja resolución.
- `/program` solo conecta la fuente al aire y la que entra en el fade, nunca las 8.
- VTR lee archivos de la carpeta `vtr/`; la tabla de posiciones a pantalla completa sale por el VTR.
- Marcador/tabla desde Google Sheets, lectura cada 2–5 s con la API (no "publicar en la web"); si falla, se conserva el último dato y se avisa en `/control`.
- Tema oscuro, colores apagados (nada muy vivo).
- Pantalla "SIN SEÑAL" cuando una cámara cae; logo de emergencia siempre disponible con un botón.
- Audio: el operador elige un audio master entre las cámaras; las demás van silenciadas; el caster va en OBS.
- Config de equipos en JSON (equipo, 2 jugadores, link VDO.Ninja o canal Twitch, logo).
- Fuera de v1: NDI, cámara virtual, replay, ingesta directa de Discord, macropad (último paso).

## Review Focus

1. Una cámara al aire se cae a mitad de directo: `/program` debe mostrar SIN SEÑAL, no negro ni imagen congelada (Task 9).
2. Google Sheets devuelve filas vacías, mal formadas o error 429/red caída: se conserva el último dato bueno y `stale=true` (Task 8).
3. Hacer CUT con preview igual a program, o hacia una fuente en `nosignal`: no rompe el estado ni deja la pantalla vacía (Task 1).
4. Nombres de equipo muy largos, con tildes o emoji en un GC o en el marcador: el texto no se sale del gráfico (Task 7).
5. El operador recarga `/control` o `/program` en medio del show, o se corta el WebSocket: la página vuelve a pedir el estado y reconecta sola (Task 2).

---

### Task 1: Estado y reducer

**Files:**
- Create: `package.json`, `server/state.js`, `tests/state.test.js`

**Interfaces:**
- Produces: `createState(config) -> State`, `reduce(state, action) -> State` (puro, no muta).
- `State = { sources: Source[], preview: id, program: id, lastTake: {mode:'cut'|'fade', from:id, to:id, seq:number}|null, audioMaster: id|null, gc: {[gcId]: {template:string, data:object, state:'off'|'preview'|'live'}}, emergency: boolean, vtr: {files:string[], current:string|null, playing:boolean}, scoreboard: {teams:{name:string,points:number,position:number}[], updatedAt:number|null, stale:boolean} }`
- `Source = {id:'cam1'..'cam8'|'vtr', label:string, kind:'vdo'|'twitch'|'vtr', status:'live'|'nosignal'}`
- Acciones: `SET_PREVIEW{id}`, `TAKE{mode:'cut'|'fade'}`, `SET_AUDIO_MASTER{id}`, `SOURCE_STATUS{id,status}`, `GC_ARM{gcId,template,data}`, `GC_LIVE{gcId}`, `GC_OFF{gcId}`, `EMERGENCY{on}`, `VTR_FILES{files}`, `VTR_SELECT{file}`, `VTR_PLAY`, `VTR_PAUSE`, `VTR_NEXT`, `SCOREBOARD_UPDATE{teams}`, `SCOREBOARD_STALE`.

- [ ] **Step 1: `git init`, crear `package.json` (`"type":"module"`, script `"test":"node --test tests/"`, dependencias `ws`).**
- [ ] **Step 2: Escribir tests en `tests/state.test.js`:** (a) `createState` con 8 equipos da 9 fuentes (`cam1..cam8`, `vtr`), `program='cam1'`, `preview='cam2'`; (b) `TAKE cut` intercambia preview y program y sube `lastTake.seq`; (c) `TAKE` con preview == program no cambia nada y no sube `seq`; (d) `TAKE` cuando preview está en `nosignal` sí corta (el operador decide) y deja `program` apuntando a esa fuente; (e) `SET_AUDIO_MASTER` con id inexistente se ignora; (f) `GC_ARM` deja `state:'preview'`, `GC_LIVE` lo pasa a `'live'`, `GC_OFF` a `'off'`, y el estado del GC es independiente de `TAKE`; (g) `EMERGENCY{on:true}` pone `emergency:true`; (h) el reducer no muta el estado de entrada.
- [ ] **Step 3: Correr `npm test`; esperar FAIL (módulo no existe).**
- [ ] **Step 4: Implementar `server/state.js`** con las firmas de arriba.
- [ ] **Step 5: Correr `npm test`; esperar PASS.**
- [ ] **Step 6: Commit** `feat: switcher state reducer`.

### Task 2: Servidor HTTP + WebSocket

**Files:**
- Create: `server/index.js`, `public/shared/client.js`, `tests/server.test.js`

**Interfaces:**
- Consumes: `createState`, `reduce` (Task 1).
- Produces: `startServer({port, config, publicDir}) -> {close(), getState()}`. WebSocket en `/ws`: al conectar envía `{type:'state', state}`; recibe `{type:'action', action}`, aplica `reduce` y difunde `{type:'state', state}` a todos. `public/shared/client.js` exporta `connect(onState) -> {send(action)}` con reconexión automática (reintento cada 1 s).

- [ ] **Step 1: Tests** (`ws` real contra puerto efímero): cliente nuevo recibe el estado inicial; una acción `SET_PREVIEW{id:'cam3'}` de un cliente llega a un segundo cliente; una acción malformada (JSON roto, tipo desconocido) se ignora sin tirar el servidor; un cliente que se conecta *después* de varias acciones recibe el estado actual (cubre recarga de página).
- [ ] **Step 2: Correr; FAIL.** **Step 3: Implementar** servidor con `http` + `ws`, sirviendo `public/` estático. `client.js` reconecta y vuelve a pedir estado (el servidor lo manda al conectar).
- [ ] **Step 4: Correr; PASS.** **Step 5: Commit** `feat: http and websocket server`.

### Task 3: Config de equipos y links de VDO.Ninja

**Files:**
- Create: `config/teams.example.json`, `server/config.js`, `server/links.js`, `tests/links.test.js`

**Interfaces:**
- Produces: `loadConfig(path) -> {teams: Team[], sheet:{id,range,apiKey}|null}`; `Team = {name, players:[string,string], source:{kind:'vdo'|'twitch', room?:string, channel?:string}, logo?:string}`; `pushLink(team) -> string`, `viewLink(team, {width:number, bitrate:number}) -> string`.

- [ ] **Step 1: Tests:** `loadConfig` rechaza (con error claro) un archivo con menos o más de 8 equipos y equipos sin 2 jugadores; `pushLink`/`viewLink` generan URLs de `https://vdo.ninja/` con `push=<room>`/`view=<room>`, y `viewLink` incluye resolución y bitrate pedidos (720p / 3000 kbps por defecto); una sala con espacios o caracteres especiales sale codificada.
- [ ] **Step 2: Correr; FAIL.** **Step 3: Implementar.** Usar los parámetros documentados de VDO.Ninja (`push`, `view`, `quality`/`bitrate`); verificar los nombres exactos en la documentación de VDO.Ninja al implementar.
- [ ] **Step 4: PASS.** **Step 5: Commit** `feat: team config and vdo.ninja links`.

### Task 4: Prototipo de rendimiento (puerta de decisión)

**Files:**
- Create: `public/spike/index.html` (desechable)

- [ ] **Step 1:** Página que abre 8 iframes de VDO.Ninja (con salas de prueba) en una grilla 4×2 a resolución chica más 1 `<video>` local.
- [ ] **Step 2:** Medir en la PC de producción (Ryzen 5 3600 / RTX 3060) con 8 emisores de prueba a 720p: uso de CPU y GPU en el Administrador de tareas, fotogramas perdidos, y cuántas conexiones sube cada emisor si además se abre `/program`.
- [ ] **Step 3: Decisión:** si CPU sostenida < 70 % y sin cortes, seguir. Si no, bajar los tiles del multiview a 360p/480p o subir a la opción 3 (escritorio con NDI) y avisar al usuario antes de continuar. Documentar resultados en `docs/superpowers/notes/perf-spike.md`. Borrar `public/spike/`.

### Task 5: Salida `/program` (cut y fade)

**Files:**
- Create: `public/program/index.html`, `public/program/program.js`, `public/shared/sources.js`, `public/shared/theme.css`

**Interfaces:**
- Consumes: `connect(onState)` (Task 2), `viewLink` (Task 3, expuesto por el servidor en `/api/sources` como `{id, url}[]`).
- Produces: `createSourceElement(source, {url}) -> HTMLElement`, `mountOnly(container, ids:string[])` (monta/desmonta fuentes; garantiza que solo existan en el DOM la fuente al aire y la entrante).

- [ ] **Step 1:** Test de `mountOnly` en `tests/sources.test.js` (con `jsdom` como devDependency): tras `TAKE`, solo las fuentes `program` y `lastTake.to` están montadas; al terminar el fade queda solo `program`.
- [ ] **Step 2: FAIL → implementar → PASS.** Fade con transición CSS de opacidad (duración configurable, 500 ms por defecto); cut inmediato.
- [ ] **Step 3: Verificación manual:** abrir `/program` en OBS como Browser Source 1920×1080 y comprobar cut y fade entre dos cámaras de prueba; confirmar en las herramientas del navegador que no hay más de 2 iframes de VDO.Ninja.
- [ ] **Step 4: Commit** `feat: program output page`.

### Task 6: Panel `/control` (multiview, preview/program, atajos)

**Files:**
- Create: `public/control/index.html`, `public/control/control.js`, `public/control/multiview.js`

**Interfaces:**
- Consumes: `connect`, `createSourceElement`.
- Layout confirmado: fila superior PREVIEW + PROGRAM grandes; debajo los 8 tiles de cámara y el tile VTR.

- [ ] **Step 1:** Cada tile de cámara en `/control` es un iframe a baja resolución; click = `SET_PREVIEW`; botones CUT y FADE = `TAKE`. Atajos de teclado: `1`–`8` cámaras, `9` VTR, `Enter` = CUT, `Espacio` = FADE (esto es la base del macropad futuro).
- [ ] **Step 2:** Test de unidad en `tests/keymap.test.js`: `keyToAction('3') -> {type:'SET_PREVIEW', id:'cam3'}`, `keyToAction('Enter') -> {type:'TAKE', mode:'cut'}`, `keyToAction(' ') -> {type:'TAKE', mode:'fade'}`, teclas desconocidas -> `null`.
- [ ] **Step 3: Verificación manual:** operar un cambio completo preview → cut → fade con dos pestañas abiertas y ver que ambas quedan iguales.
- [ ] **Step 4: Commit** `feat: control panel and keymap`.

### Task 7: Gráficos con preview (GC, SIN SEÑAL, emergencia)

**Files:**
- Create: `public/graphics/templates.js`, `public/graphics/graphics.css`, `tests/templates.test.js`

**Interfaces:**
- Produces: `renderGraphic(template:'gc-name'|'scoreboard'|'standings'|'nosignal'|'emergency', data:object) -> HTMLElement`. El mismo renderizador se usa en el tile PREVIEW (para GC en `state:'preview'`), en el tile PROGRAM y en `/program` (para `state:'live'`).

- [ ] **Step 1: Tests (jsdom):** `renderGraphic('gc-name', {team, player})` incluye ambos textos; un nombre de 80 caracteres con tildes y emoji se renderiza con la clase `ellipsis` (truncado por CSS) y sin lanzar error; `nosignal` muestra el texto "SIN SEÑAL"; `emergency` muestra el logo configurado.
- [ ] **Step 2: FAIL → implementar → PASS.** Paleta oscura apagada definida como variables CSS en `theme.css`.
- [ ] **Step 3:** Conectar: `/control` muestra los GC en `preview` sobre el tile PREVIEW; `/program` muestra solo los `live`; botones "GC a preview", "GC al aire", "bajar GC" y botón EMERGENCIA.
- [ ] **Step 4: Verificación manual:** armar un GC, verlo solo en PREVIEW, lanzarlo al aire, cambiar de cámara con el GC al aire, bajarlo.
- [ ] **Step 5: Commit** `feat: graphics with preview`.

### Task 8: Marcador y tabla desde Google Sheets

**Files:**
- Create: `server/sheets.js`, `tests/sheets.test.js`

**Interfaces:**
- Produces: `parseRows(values: string[][]) -> {name,points,position}[]` (ignora filas vacías o sin nombre; puntos no numéricos cuentan como 0); `startSheetPoller({config, fetchFn, onUpdate, onStale, intervalMs=3000}) -> {stop()}`. `onUpdate(teams)` despacha `SCOREBOARD_UPDATE`; `onStale()` despacha `SCOREBOARD_STALE`.

- [ ] **Step 1: Tests** con `fetchFn` falso: filas válidas se parsean; filas vacías/malformadas se saltan; una respuesta 429 o un fetch que lanza llama a `onStale` y **no** a `onUpdate`; tras un fallo, la siguiente respuesta válida limpia `stale`; `stop()` detiene el sondeo.
- [ ] **Step 2: FAIL → implementar → PASS** (API v4 `values.get` con clave de API; `intervalMs` entre 2000 y 5000).
- [ ] **Step 3:** Crear hoja plantilla con columnas fijas (equipo, puntos, posición; posición por fórmula) usando el conector de Google Sheets y documentar el `sheet.id` y rango en `config/teams.example.json`.
- [ ] **Step 4:** `/control` muestra un indicador "marcador sin actualizar" cuando `scoreboard.stale`. Commit `feat: google sheets scoreboard`.

### Task 9: SIN SEÑAL y estado de fuentes

**Files:**
- Modify: `public/shared/sources.js`, `public/program/program.js`, `public/control/multiview.js`

- [ ] **Step 1: Test (jsdom)** en `tests/sources.test.js`: un `SOURCE_STATUS{id:'cam4', status:'nosignal'}` con `program='cam4'` hace que `/program` renderice `nosignal` en lugar del iframe (nunca contenedor vacío).
- [ ] **Step 2: FAIL → implementar → PASS.** Detectar caída con el evento de la API de VDO.Ninja (conexión perdida / sin video entrante) o, como respaldo, ausencia de fotogramas por 3 s; despachar `SOURCE_STATUS`. Si la señal vuelve, volver a `live`.
- [ ] **Step 3: Verificación manual:** cerrar la pestaña de un emisor de prueba al aire y comprobar SIN SEÑAL en `/program` y tile rojo apagado en `/control`. Commit `feat: no-signal handling`.

### Task 10: Audio master

**Files:**
- Modify: `public/program/program.js`, `public/control/control.js`

- [ ] **Step 1: Test (jsdom):** con `audioMaster='cam2'`, solo el elemento de `cam2` queda sin mute en `/program`; con `audioMaster=null` todo queda silenciado; el VTR suena solo mientras `vtr.playing`.
- [ ] **Step 2: FAIL → implementar → PASS.** Control de audio master por botón en cada tile de `/control` (`SET_AUDIO_MASTER`), independiente de la cámara al aire.
- [ ] **Step 3: Verificación manual:** en OBS, confirmar que `/program` entrega solo el audio de la cámara master (captura de audio del Browser Source activada). Commit `feat: audio master`.

### Task 11: VTR (videos, logos, tabla a pantalla completa)

**Files:**
- Create: `server/vtr.js`, `tests/vtr.test.js`, `vtr/.gitkeep`
- Modify: `public/control/control.js`, `public/program/program.js`

**Interfaces:**
- Produces: `listMedia(dir) -> string[]` (solo `.mp4 .webm .mov .png .jpg .svg`, ordenados por nombre); el servidor sirve `vtr/` en `/vtr/<archivo>`.

- [ ] **Step 1: Tests:** carpeta vacía -> `[]` (la UI muestra "sin archivos" y no falla); archivos no soportados (`.txt`, `.DS_Store`) se ignoran; el orden es alfabético; un archivo borrado entre lecturas no lanza error.
- [ ] **Step 2: FAIL → implementar → PASS.** Lista de archivos en `/control` con play/pausa/siguiente (`VTR_*`); imágenes se muestran fijas, videos se reproducen. La tabla de posiciones a pantalla completa se muestra como fuente VTR (`renderGraphic('standings', ...)`) para que salga por el VTR.
- [ ] **Step 3: Verificación manual:** cargar logo, intro y probar cut al VTR. Commit `feat: vtr source`.

### Task 12: Lanzador, README y perfiles de rendimiento

**Files:**
- Create: `start.bat`, `README.md`, `config/profiles.json`, `tests/profiles.test.js`

- [ ] **Step 1: Tests:** `loadProfile('720p') -> {tileWidth, tileBitrate, programBitrate}`; perfil desconocido cae al perfil por defecto y avisa en consola. Perfiles: `720p` (por defecto, 2–4 Mbps), `480p-tiles`, `ligero` para PCs modestas.
- [ ] **Step 2: FAIL → implementar → PASS.** `start.bat` instala dependencias si faltan y abre el servidor y `/control`.
- [ ] **Step 3:** README corto en español: requisitos (Node 20+), cómo pasar los links `push` a los equipos, cómo agregar `/program` en OBS (Browser Source 1920×1080, "controlar audio vía OBS"), cómo usar la hoja de Google y la clave de API. Commit `docs: launcher and readme`.

### Task 13 (último): Macropad Redragon

**Files:**
- Modify: `public/control/control.js`, `README.md`

- [ ] **Step 1:** Con el modelo definido por el usuario, comprobar si el macropad manda teclas estándar. Si sí, asignar las teclas de la Task 6 más "GC a preview", "GC al aire", "bajar GC" y EMERGENCIA, y documentar el mapeo en el README. Si no, decidir con el usuario cómo leerlo antes de seguir.
- [ ] **Step 2: Verificación manual** de cada tecla en `/control` con el foco en la página y en OBS abierto. Commit `feat: macropad mapping`.
