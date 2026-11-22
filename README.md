# Multicam Switcher

Un "ATEM" web para torneos: recibe las cámaras de los equipos (VDO.Ninja), tiene multiview con Preview/Program, pantalla dividida,
GC con estilos, marcador desde Google Sheets, VTR, emergencia y mezclador de audio. OBS solo carga la salida `/program`.

## Requisitos
- Windows con **Node.js 20+** y Chrome/Edge.
- Red: con 9 cámaras a 1080p30 calcula unos 40–60 Mbps de bajada. Si tu PC o tu red van justas, usa el perfil `720p` (ver "Rendimiento").

## Primer uso
1. Doble clic en `start.bat`. La primera vez crea `config\teams.json` y lo abre: pon tus equipos (nombre y sala) y, si quieres, la cámara aérea.
2. Vuelve a abrir `start.bat`: levanta el servidor y abre el panel como ventana de aplicación (Edge sin pestañas); si no hay Edge, usa tu navegador en `http://localhost:3000/control/`.
3. Tus datos (pantalla dividida, peleas, GC, nombres, salas, contraseña, emergencia) se guardan solos en `data/split.json`. **Haz una copia de ese archivo** si te importa conservarlos. El servidor escucha solo en esta PC (`HOST=0.0.0.0` para cambiarlo).

## Teclas
| Tecla | Acción |
|---|---|
| `1`–`8` | cámara de cada equipo a Preview |
| `9` | cámara aérea a Preview |
| `0` | VTR a Preview |
| `s` | pantalla dividida a Preview |
| `Espacio` | **CUT** (Preview ↔ Program) |
| `Enter` | **FADE** |
| `[` `]` | cámara anterior / siguiente en Preview |
| `-` `=` `m` | volumen de las cámaras / mute |
| `,` `.` `p` | VTR anterior / siguiente / play-pausa |

Click en un tile = a Preview. Doble clic sobre el nombre de una cámara = ponerle tu propio nombre. `⚠` marca "sin señal" a mano; `🔊` enciende/apaga su audio. Si la misma cámara está en Preview y Program, la ventana Preview la muestra igual (abre una segunda conexión a ese jugador mientras coincidan).

## Conectar las cámaras (VDO.Ninja)
Abre el desplegable **"Conexión de cámaras"**:
- **Contraseña del torneo** (solo letras y números; la misma para todas), **calidad** (1080p/720p) y **FPS**.
- Cada cámara tiene su propia **sala** (editable). «Generar salas aleatorias» crea salas difíciles de adivinar.
- Por cámara: **Link navegador**, **Link OBS** y **Mensaje para el jugador** (texto listo para pegar en Discord/WhatsApp con los pasos).
- Si cambias contraseña, calidad o una sala, hay que volver a enviar los links (las cámaras se reconectan solas en el panel y en `/program`).
- Un solo jugador por equipo envía la señal.

**Dos formas de transmitir:**
1. **Navegador (la más simple):** el jugador abre el *Link navegador*, comparte su pantalla/ventana y marca *compartir audio* (compartir solo una ventana normalmente no incluye audio).
2. **OBS (mejor calidad):** el jugador pulsa *Iniciar cámara virtual* en OBS, abre el *Link OBS* y elige "OBS Virtual Camera" (y un cable de audio virtual para el sonido del juego). **No uses la salida WHIP de OBS**: solo admite un espectador y esta aplicación abre varias conexiones por cámara.

La cámara aérea se conecta igual que las demás (con el nombre que le pongas). `npm run links` imprime los links base en la terminal.

## OBS y salida NDI
- Agrega una **Browser Source**: URL `http://localhost:3000/program/`, ancho 1920, alto 1080, **FPS 30**, y marca **"Controlar audio mediante OBS"**.
- **NDI:** lo saca OBS, no esta aplicación. Con el plugin DistroAV (OBS-NDI) usa *Salida NDI del programa* o *Salida NDI dedicada* a 1080p30. El NDI consume mucha red (~100–150 Mbps por flujo): usa cable gigabit.
- Si abres OBS antes que el servidor, actualiza la fuente del navegador.

## GC (gráficos)
- **GC nombre:** Título y Subtítulo libres (elegir un equipo solo rellena el título). "a preview" → se ve solo en la ventana Preview; "al aire" → sale; "bajar" → se va.
- **Mover GC:** arrastra el GC de nombre y el marcador donde quieras (se guarda; en vivo si están al aire).
- **Estilo de los GC** (desplegable), separado para *pantalla única*, *pantalla dividida* y *marcador*: colores (fondo, opacidad, texto, subtítulo, acento), **tamaño**, **plantilla PNG** (620 × 120 px; usa 1240 × 240 para más nitidez; descarga el «Molde PNG»), **efecto de entrada** (aparecer, deslizar izquierda/derecha, subir, zoom, máquina de escribir), **efecto de salida** y **«Se baja solo a los N segundos»** (0 = manual). La vista previa se ve al lado.

## Marcador (Google Sheets)
1. Crea una hoja importando `config/sheet-template.csv` (columnas: Equipo, Puntos, Posición). Compártela con "Cualquiera con el enlace puede ver".
2. En Google Cloud habilita la **Google Sheets API** y crea una **clave de API**.
3. En `config\teams.json`: `"sheet": {"id": "ID_DE_LA_HOJA", "range": "'Hoja 1'!A2:C9", "apiKey": "TU_CLAVE"}` (el rango **sin** la fila de títulos; si la pestaña tiene espacios, entre comillas simples).
4. Reinicia el servidor. Cambia un punto en la hoja: en ~3 s se actualiza. Prueba con **Marcador → a preview → al aire**.
Si falla, el panel muestra "marcador sin actualizar" y deja el último dato. Sin Google Sheets el marcador sale vacío.

## Pantalla dividida (peleas)
Es una fuente más (`s`): se manda a Preview y se toma con CUT/FADE. En el panel:
1. **Cámaras en pantalla:** clic en los botones de las cámaras (hasta 9, en el orden que quieras); se acomodan solas (2 quedan lado a lado). Los desplegables con nombre ("Izquierda", "Derecha"…) cambian quién va dónde.
2. **Arrastra** los recuadros para moverlos y la esquina para el tamaño ("mantener 16:9" evita franjas). «Restablecer posiciones» devuelve recuadros **y GC** a su sitio.
3. **GC por recuadro:** título y subtítulo en cada uno (se rellena con el nombre del equipo; lo que escribas se respeta). Arrastra la etiqueta roja dentro del recuadro. «GC de la dividida»: a preview / al aire / bajar.
4. **Audio:** el 🔊 de cada recuadro elige qué cámaras suenan **mientras la dividida está al aire** (al salir vuelve el mezclador como estaba).
5. **Fondos por cantidad** (desplegable): elige la cantidad, «Cargar fondo», y «Molde PNG» descarga una guía 1920×1080 con las medidas en píxeles de cada recuadro para mandar a diseñar el fondo. También se detecta `split-2.png`, `split-3.png`… en `vtr/`.
6. **Peleas:** nombre + «Guardar» recuerda cámaras, posiciones, textos y audio; «Cargar» las recupera.

## VTR y emergencia
- **VTR:** «Subir archivos» (videos `.mp4 .webm .mov` o imágenes `.png .jpg .svg`; también puedes copiarlos a `vtr/`). Fader de volumen en su tile. La "Tabla de posiciones" sale por el VTR. `"vtrDefault": "standby.png"` en la config lo deja con una imagen por defecto.
- **Emergencia:** botón **EMERGENCIA** (pone/quita). Elige una **foto o un video** (se repite, sin sonido) con «Emergencia: …» o súbelo con «Subir».

## Audio
- **Faders en cada cámara** y el **Mezclador de audio** (desplegable): varias cámaras pueden sonar a la vez, cada una a su nivel; también nivel general y VTR. Cada cámara con audio encendido es una conexión extra a ese jugador.
- El audio **sale solo por `/program`** (la fuente del navegador en OBS). El panel va en silencio a propósito. Para oírlo: en OBS, *Propiedades avanzadas de audio* → *Monitoreo de audio* → «Solo monitor» o «Monitor y salida».
- **Probar audio:** el botón "Probar audio (bip)" del mezclador hace sonar un bip en `/program`: si el medidor de OBS se mueve, el audio llega bien a OBS.
- **VTR:** suena solo si está **al aire** y en **▶**; el panel te dice el motivo si no se oye.

## Cámaras visibles y nombres
Arriba: **Equipos [N]** oculta del todo las cámaras sobrantes (tiles, botones, mezclador, teclas), y **aérea** la muestra/oculta. Doble clic en el nombre de una cámara para personalizarlo.

## Macropad Redragon SS-552 (10 teclas + 4 diales)
Dos formas (usa la que permita tu Redragon Station):
1. **Ejecutar un programa** (funciona aunque el foco esté en OBS): en cada tecla/dial pon `macropad\cmd.bat <comando>`.
2. **Mandar una tecla:** las de la tabla de arriba; solo funcionan con el panel en primer plano.

| Control | Girar → | Girar ← | Presionar |
|---|---|---|---|
| Dial 1 (cámara a preview) | `preview-next` | `preview-prev` | `cut` |
| Dial 2 (elegir cámara de audio; borde punteado) | `mix-next` | `mix-prev` | `mix-toggle` |
| Dial 3 (volumen de la cámara elegida) | `mix-up` | `mix-down` | `mute` |
| Dial 4 (duración del fade) | `fade-longer` | `fade-shorter` | `fade` |

Teclas sugeridas: `cut`, `fade`, `gc-name-preview`, `gc-name-live`, `gc-name-off`, `gc-score-live`, `gc-score-off`, `split-gc-live`, `vtr-toggle`, `emergency-toggle`.
Otros comandos: `cam1`…`cam9`, `vtr`, `split`, `audio-next/prev/clear`, `vol-up/down`, `mute`, `vtr-vol-up/down`, `vtr-mute`, `vtr-play/pause/next/prev`, `gc-score-preview`, `gc-player-next`, `split-gc-preview/off`, `emergency-on/off`, `test-tone`.
Prueba sin macropad: `curl -X POST http://127.0.0.1:3000/api/do/cut` (solo POST; rechaza peticiones de otras páginas web).

## Rendimiento
`"profile": "1080p30" | "720p" | "480p-tiles" | "ligero"` en `config\teams.json` (o variable `PROFILE`); se editan en `config/profiles.json`. La medición con emisores reales sigue pendiente: `docs/superpowers/notes/perf-spike.md`.

## Desarrollo
`npm test` (≈10 s). Diseño: `docs/superpowers/specs/`. Plan: `docs/superpowers/plans/`. Variable `SPLIT_FILE` guarda los datos en otro archivo (para pruebas; por defecto `data/split.json`).
