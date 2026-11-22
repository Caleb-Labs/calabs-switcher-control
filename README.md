# Multicam Switcher

Un "ATEM" web para torneos: recibe las cámaras de los equipos (VDO.Ninja), tiene multiview con Preview/Program,
GC con preview, marcador desde Google Sheets y VTR. OBS solo carga la salida `/program`.

## Requisitos
- Windows con **Node.js 20+** y Chrome/Edge.
- Bajada de red: ~25–35 Mbps para 8 cámaras a 720p.

## Primer uso
1. Doble clic en `start.bat`. La primera vez crea `config\teams.json` y lo abre: pon los 8 equipos
   (nombre, 2 jugadores, `source`: `{"kind":"vdo","room":"nombre-unico"}` o `{"kind":"twitch","channel":"canal"}`).
2. Vuelve a abrir `start.bat`: levanta el servidor y abre el panel como ventana de aplicación (Edge sin pestañas); si no hay Edge, usa tu navegador en `http://localhost:3000/control/`.

## Que cada equipo envíe su juego
`npm run links` imprime el link de envío de cada equipo (`https://vdo.ninja/?push=...&quality=1`).
Cada equipo abre su link y elige capturar la pantalla/ventana de Sea of Thieves. (Discord no se puede jalar por link.)

## OBS
Agrega una **Browser Source**: URL `http://localhost:3000/program/`, ancho 1920, alto 1080, y marca
**"Controlar audio mediante OBS"**. El audio de los casters va en OBS; de las cámaras suena solo la que marques con 🔊 (audio master).

## Operación
| Tecla | Acción |
|---|---|
| `1`–`8` | cámara de cada equipo a Preview |
| `9` | cámara aérea a Preview |
| `0` | VTR a Preview |
| `s` | pantalla dividida a Preview |
| `Enter` / `Espacio` | CUT / FADE (Preview ↔ Program) |

- El panel es fluido: se adapta al tamaño de la ventana del navegador. El slider de arriba ajusta qué tan grandes son Preview/Program (se recuerda en el navegador; `↺` vuelve al valor por defecto).
- **Fade:** el slider "Duración" (arriba, 0.1 a 5 s) y los comandos `fade-longer` / `fade-shorter` para un dial. El fade se ve en `/program` y también en el panel.
- Si una cámara ya está en Program y la mandas a Preview, la ventana Preview la muestra igual (abre una segunda conexión a ese jugador solo mientras coincidan).
- Click en un tile = a Preview. `⚠` marca una cámara "sin señal" a mano; `🔊` = audio master.
- **GC**: el texto es **libre** (Título y Subtítulo); elegir equipo/jugador solo los rellena. "a preview" (se ve solo en el tile PREVIEW) → "al aire" → "bajar". En **"Mover GC"** arrastras el GC de nombre y el marcador al lugar que quieras (se guarda; si están al aire se mueven en vivo).
- **EMERGENCIA** pone el logo de emergencia (`"emergencyLogo": "/vtr/emergencia.png"` en la config).
- **VTR**: usa el botón **"Subir archivos"** del panel (videos `.mp4 .webm .mov` o imágenes `.png .jpg .svg`; también puedes copiarlos a la carpeta `vtr/`). "Tabla de posiciones" sale por el VTR. Sin archivo elegido muestra un cartel "VTR · sin archivo seleccionado".
- Las cámaras se llaman **Cámara 1 … Cámara 9** (la 9 es la aérea). El nombre del equipo se usa solo en los GC.

## Cámara aérea
En `config\teams.json` agrega `"aerial": {"name": "Cámara aérea", "source": {"kind": "vdo", "room": "sala-aerea"}}`.
Aparece como la cámara 9 (tecla `9`, comando `cam9`), entra en `npm run links` y puede ser audio master.

## Pantalla dividida (peleas)
Es una fuente más (`s`, comando `split`): se manda a Preview y se toma con CUT/FADE como cualquier cámara. En el panel "Pantalla dividida":
1. En **"Cámaras en pantalla"** haz clic en los botones de las cámaras que quieres, en el orden que quieras (hasta 9; por ejemplo 1 y 4). La cantidad sale de cuántas elijas y se acomodan solas (2 quedan lado a lado). Para cambiar quién va en cada posición usa los desplegables con nombre ("Izquierda", "Derecha"…).
2. **Arrastra** los recuadros del lienzo para moverlos y usa la esquina para cambiar el tamaño ("mantener 16:9" evita franjas negras). `/program` se actualiza en vivo si está al aire.
3. **Fondos por cantidad:** abajo del panel hay una ficha por cada cantidad (1 a 9 cámaras) con su vista previa. En cada ficha: **"Molde PNG"** descarga una guía 1920×1080 con los recuadros y sus medidas en píxeles (también se ven en "Medidas") para mandar a diseñar el fondo; **"Cargar fondo"** sube la imagen y la asigna a esa cantidad; y el desplegable cambia el fondo por otro ya subido. Los recuadros de cámara quedan por encima del fondo. Si cambias las posiciones, descarga el molde otra vez. También se detecta solo un archivo `split-2.png`, `split-3.png`… en `vtr/`.
4. **Peleas:** escribe un nombre ("Pelea 1") y "Guardar" para recordar cámaras + posiciones. Después "Cargar" y listo; así no necesitas un macro por cada combinación.
**GC por recuadro:** cada recuadro tiene su propio GC (título y subtítulo; al elegir una cámara se rellena con el nombre de su equipo, y lo que escribas a mano se respeta). Arrastra la etiqueta roja dentro del recuadro para moverlo. Con los botones "GC de la dividida" lo pones a preview, al aire o lo bajas; solo se ve si la dividida está en Preview/Program. Las peleas guardadas recuerdan también estos textos.
Cada cantidad recuerda su propio arreglo. Todo se guarda en `data/split.json` y sobrevive a reinicios.
En el panel la dividida se ve como un esquema (fondo + recuadros con nombres); el video real solo se compone en `/program`.

## Audio
- **Faders en cada cámara:** cada tile de cámara tiene su fader de volumen y su 🔊 (enciende/apaga). Los diales pueden manejar todos con `mix-next/prev`, `mix-up/down` y `mix-toggle`.
- **Mezclador de audio** (desplegable en el panel): una casilla y un fader por cada cámara, nivel general de cámaras y fader del VTR. Pueden sonar varias cámaras a la vez, cada una con su nivel. El 🔊 de cada tile sigue siendo el "audio principal" (para el macropad).
- Cada cámara con audio encendido se conecta (oculta) en `/program`: es una conexión más de ese jugador.
- El audio **sale solo por `/program`**, o sea por la fuente del navegador en OBS. El panel va en silencio a propósito. Para **oírlo tú**, en OBS: *Propiedades avanzadas de audio* → *Monitoreo de audio* → «Solo monitor» o «Monitor y salida» en esa fuente; y en la fuente del navegador marca «Controlar audio mediante OBS».
- **Probar audio:** el botón "Probar audio (bip)" del mezclador hace que `/program` emita un bip de 0.7 s. Si en OBS se mueve el medidor de esa fuente, el audio llega bien a OBS (y entonces el problema está en la cámara o el VTR, no en OBS).
- **Audio de los jugadores:** en VDO.Ninja, compartir *una ventana* normalmente **no incluye audio**. Cada jugador debe elegir compartir audio (pestaña/pantalla con "compartir audio del sistema") o usar su micrófono/mezcla; si no, no hay nada que oír aunque todo esté bien configurado aquí.
- **VTR:** suena solo si está **al aire (Program)** y en **▶**; el panel te dice el motivo si no se oye ("En pausa", "NO está al aire", "Silenciado"…).

## Macropad Redragon SS-552 (10 teclas + 4 diales)
Hay dos formas; usa la que permita tu Redragon Station (no pude comprobar cuál admite):
1. **Ejecutar un programa** (la mejor: funciona aunque el foco esté en OBS): en cada tecla/dial pon `macropad\cmd.bat <comando>`.
2. **Mandar una tecla**: usa las teclas de la tabla de arriba (+ `[` `]` preview, `-` `=` volumen, `m` mute, `,` `.` VTR anterior/siguiente, `p` VTR play/pausa). Solo funciona con la pestaña `/control` en primer plano.

Propuesta de asignación:

| Control | Girar → | Girar ← | Presionar |
|---|---|---|---|
| Dial 1 (cámara a preview) | `preview-next` | `preview-prev` | `cut` |
| Dial 2 (elegir cámara de audio; se marca con borde punteado) | `mix-next` | `mix-prev` | `mix-toggle` (enciende/apaga su audio) |
| Dial 3 (volumen de la cámara elegida) | `mix-up` | `mix-down` | `mute` (silencia todas las cámaras) |
| Dial 4 (duración del fade) | `fade-longer` | `fade-shorter` | `fade` |

Teclas: `cut`, `fade`, `gc-name-preview`, `gc-name-live`, `gc-name-off`, `gc-score-live`, `gc-score-off`, `vtr-toggle`, `gc-player-next`, `emergency-toggle`.
Otros comandos: `cam1`…`cam9`, `vtr`, `split`, `audio-clear`, `vtr-vol-up`, `vtr-vol-down`, `vtr-mute`, `vtr-play`, `vtr-pause`, `gc-score-preview`, `emergency-on`, `emergency-off`.
`gc-name-preview` arma el GC con el equipo que esté en Preview; `gc-player-next` alterna entre sus 2 jugadores.
Cada paso de volumen es 5 %. Comandos extra: `split-gc-preview`, `split-gc-live`, `split-gc-off`. El volumen y el mute se ven arriba en el panel.

Prueba sin macropad: `curl -X POST http://127.0.0.1:3000/api/do/cut`. Solo acepta POST y rechaza peticiones de otras páginas web.

## Imagen o video por defecto del VTR
Pon un archivo en `vtr/` (por ejemplo `standby.png`) y en la config `"vtrDefault": "standby.png"`. Se selecciona solo y se muestra
cuando no hay nada elegido o se borra el archivo actual, así un corte al VTR nunca queda en negro.

## Marcador (Google Sheets)
1. Crea una hoja importando `config/sheet-template.csv` (columnas: Equipo, Puntos, Posición; la posición puedes calcularla con fórmula).
2. Compártela como "Cualquiera con el enlace puede ver" y da permiso de edición a quien lleve el marcador.
3. Habilita la **Google Sheets API** en Google Cloud y crea una **clave de API**.
4. En `config\teams.json`: `"sheet": {"id": "ID_DE_LA_HOJA", "range": "Hoja 1!A2:C9", "apiKey": "TU_CLAVE"}` (el rango **sin** la fila de títulos).
El programa lee la hoja cada ~3 s; si falla, deja el último dato y muestra "marcador sin actualizar".

## Rendimiento
`"profile": "720p" | "480p-tiles" | "ligero"` en `config\teams.json` (o variable `PROFILE`). Los perfiles se editan en
`config/profiles.json`. Si tu PC va justa, usa `ligero`. La medición pendiente está en `docs/superpowers/notes/perf-spike.md`.

## Desarrollo
El servidor escucha solo en 127.0.0.1 (esta PC). Si OBS corre en otra PC: `set HOST=0.0.0.0` antes de `npm start`.

Variable `SPLIT_FILE` para guardar los datos de la pantalla dividida y los GC en otro archivo (útil para pruebas; por defecto `data/split.json`).

`npm test` (≈7 s). Diseño: `docs/superpowers/specs/`. Plan: `docs/superpowers/plans/`.
