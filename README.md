# Multicam Switcher

Un "ATEM" web para torneos: recibe las cámaras de los equipos (VDO.Ninja), tiene multiview con Preview/Program,
GC con preview, marcador desde Google Sheets y VTR. OBS solo carga la salida `/program`.

## Requisitos
- Windows con **Node.js 20+** y Chrome/Edge.
- Bajada de red: ~25–35 Mbps para 8 cámaras a 720p.

## Primer uso
1. Doble clic en `start.bat`. La primera vez crea `config\teams.json` y lo abre: pon los 8 equipos
   (nombre, 2 jugadores, `source`: `{"kind":"vdo","room":"nombre-unico"}` o `{"kind":"twitch","channel":"canal"}`).
2. Vuelve a abrir `start.bat`: levanta el servidor y abre el panel `http://localhost:3000/control/`.

## Que cada equipo envíe su juego
`npm run links` imprime el link de envío de cada equipo (`https://vdo.ninja/?push=...&quality=1`).
Cada equipo abre su link y elige capturar la pantalla/ventana de Sea of Thieves. (Discord no se puede jalar por link.)

## OBS
Agrega una **Browser Source**: URL `http://localhost:3000/program/`, ancho 1920, alto 1080, y marca
**"Controlar audio mediante OBS"**. El audio de los casters va en OBS; de las cámaras suena solo la que marques con 🔊 (audio master).

## Operación
| Tecla | Acción |
|---|---|
| `1`–`8` | cámara a Preview |
| `9` | VTR a Preview |
| `Enter` / `Espacio` | CUT / FADE (Preview ↔ Program) |

- Click en un tile = a Preview. `⚠` marca una cámara "sin señal" a mano; `🔊` = audio master.
- **GC**: elige equipo/jugador → "a preview" (se ve solo en el tile PREVIEW) → "al aire" → "bajar".
- **EMERGENCIA** pone el logo de emergencia (`"emergencyLogo": "/vtr/emergencia.png"` en la config).
- **VTR**: pon videos (`.mp4 .webm .mov`) e imágenes (`.png .jpg .svg`) en la carpeta `vtr/`. "Tabla de posiciones" sale por el VTR.

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
