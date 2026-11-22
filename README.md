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
- Click en un tile = a Preview. `⚠` marca una cámara "sin señal" a mano; `🔊` = audio master.
- **GC**: elige equipo/jugador → "a preview" (se ve solo en el tile PREVIEW) → "al aire" → "bajar".
- **EMERGENCIA** pone el logo de emergencia (`"emergencyLogo": "/vtr/emergencia.png"` en la config).
- **VTR**: pon videos (`.mp4 .webm .mov`) e imágenes (`.png .jpg .svg`) en la carpeta `vtr/`. "Tabla de posiciones" sale por el VTR.

## Cámara aérea
En `config\teams.json` agrega `"aerial": {"name": "Cámara aérea", "source": {"kind": "vdo", "room": "sala-aerea"}}`.
Aparece como la cámara 9 (tecla `9`, comando `cam9`), entra en `npm run links` y puede ser audio master.

## Pantalla dividida (peleas)
Es una fuente más (`s`, comando `split`): se manda a Preview y se toma con CUT/FADE como cualquier cámara. En el panel "Pantalla dividida":
1. En **"Cámaras en pantalla"** haz clic en los botones de las cámaras que quieres, en el orden que quieras (hasta 9; por ejemplo 1 y 4). La cantidad sale de cuántas elijas y se acomodan solas (2 quedan lado a lado). Para cambiar quién va en cada posición usa los desplegables con nombre ("Izquierda", "Derecha"…).
2. **Arrastra** los recuadros del lienzo para moverlos y usa la esquina para cambiar el tamaño ("mantener 16:9" evita franjas negras). `/program` se actualiza en vivo si está al aire.
3. **Fondo por cantidad:** cada cantidad (2, 3, 4…) tiene su fondo. Se detecta solo si pones en `vtr/` un archivo llamado `split-2.png`, `split-3.png`, `split-4.png`… (también `.jpg .svg .mp4 .webm .mov`; `split-1` a `split-9`), o lo eliges en el menú "Fondo".
4. **Peleas:** escribe un nombre ("Pelea 1") y "Guardar" para recordar cámaras + posiciones. Después "Cargar" y listo; así no necesitas un macro por cada combinación.
Cada cantidad recuerda su propio arreglo. Todo se guarda en `data/split.json` y sobrevive a reinicios.
En el panel la dividida se ve como un esquema (fondo + recuadros con nombres); el video real solo se compone en `/program`.

## Macropad Redragon SS-552 (10 teclas + 4 diales)
Hay dos formas; usa la que permita tu Redragon Station (no pude comprobar cuál admite):
1. **Ejecutar un programa** (la mejor: funciona aunque el foco esté en OBS): en cada tecla/dial pon `macropad\cmd.bat <comando>`.
2. **Mandar una tecla**: usa las teclas de la tabla de arriba (+ `[` `]` preview, `-` `=` volumen, `m` mute, `,` `.` VTR anterior/siguiente, `p` VTR play/pausa). Solo funciona con la pestaña `/control` en primer plano.

Propuesta de asignación:

| Control | Girar → | Girar ← | Presionar |
|---|---|---|---|
| Dial 1 (cámara a preview) | `preview-next` | `preview-prev` | `cut` |
| Dial 2 (audio master) | `audio-next` | `audio-prev` | `audio-clear` |
| Dial 3 (volumen cámara) | `vol-up` | `vol-down` | `mute` |
| Dial 4 (VTR) | `vtr-next` | `vtr-prev` | `vtr-toggle` |

Teclas: `cut`, `fade`, `gc-name-preview`, `gc-name-live`, `gc-name-off`, `gc-score-live`, `gc-score-off`, `vtr-toggle`, `gc-player-next`, `emergency-toggle`.
Otros comandos: `cam1`…`cam9`, `vtr`, `split`, `audio-clear`, `vtr-vol-up`, `vtr-vol-down`, `vtr-mute`, `vtr-play`, `vtr-pause`, `gc-score-preview`, `emergency-on`, `emergency-off`.
`gc-name-preview` arma el GC con el equipo que esté en Preview; `gc-player-next` alterna entre sus 2 jugadores.
Cada paso de volumen es 5 %. El volumen y el mute se ven arriba en el panel.

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

`npm test` (≈7 s). Diseño: `docs/superpowers/specs/`. Plan: `docs/superpowers/plans/`.
