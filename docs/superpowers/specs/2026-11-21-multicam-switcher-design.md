# Multicam Switcher (mini ATEM web) — Diseño

Fecha: 2026-11-21 · Estado: pendiente de aprobación

## Intención
La comunidad de Sea of Thieves hace torneos y los transmite. Los participantes ya transmiten su juego
(por Discord o Twitch). Se necesita un **switcher tipo ATEM** que reciba esas señales en vivo,
muestre un **multiview** y un **program**, permita cambiar de cámara con cortes/fades, y tenga
**gráficos propios** (GC, nombres, marcadores). OBS se usa solo para sacar el program a la transmisión.

## Objetivos
- Recibir 8 cámaras en vivo (una por equipo) con baja latencia.
- Una fuente VTR para reproducir videos/clips al aire.
- Multiview (todas las cámaras) + Program (lo que sale al aire) en el mismo programa.
- Cambio de cámara con cut y fade; preview/program estilo ATEM.
- Gráficos en el programa (HTML/CSS): GC con nombre del jugador, marcador, logos del torneo.
- Control físico con el macropad Redragon (teclas = cámaras / acciones). Se ve al final del proyecto.
- Que otras personas de la comunidad puedan instalarlo y usarlo en su PC: un solo lanzador, un README corto y perfiles de rendimiento (ver "Rendimiento").
- Pantalla "SIN SEÑAL" cuando una cámara cae; el operador cambia manualmente.
- Logo de emergencia disponible con un botón, por si pasa algo en directo.
- Salida a OBS como Browser Source 1080p.

## No-objetivos
- No transmite ni graba por sí mismo (eso es OBS).
- No es un editor de VODs. **Replay de jugadas queda para una versión futura** (idea: guardar un buffer de los últimos minutos de cada cámara para sacar clips; se diseña después).
- NDI nativo y cámara virtual quedan fuera de la v1.
- No ingiere Discord directamente (no hay forma por link).

## Anti-objetivos (sería un fracaso aunque funcione)
- Que haga falta abrir OBS para cambiar de cámara o poner gráficos.
- Que el switch tenga lag perceptible o se cuelgue en pleno directo.
- Que los jugadores necesiten instalar software raro.

## Restricciones
- Una sola PC de producción (Windows probable; el folder está en un disco montado desde WSL).
- Rendimiento del navegador con varias cámaras de video simultáneas.
- Los jugadores ya transmiten; el cambio de método debe ser fácil para ellos.

## Enfoques considerados
1. **OBS como motor** (browser sources + obs-websocket). Rápido, pero multiview y gráficos limitados; es lo "mañoso" que se quiere evitar.
2. **App web propia, OBS solo de salida** ← **elegido por el usuario**. Gráficos flexibles, todo en un lugar, salida simple. Riesgo: rendimiento con muchas cámaras.
3. **App de escritorio con NDI nativo.** Más trabajo; se puede llegar desde la 2 sin tirar lo hecho.

## Diseño
**Entrada de señal (por prioridad):**
- **VDO.Ninja** (recomendado): el jugador abre un link y envía su juego por WebRTC (<1 s). Cada cámara se muestra como un iframe/video en la página.
- **Twitch** (respaldo): embed o HLS del canal del jugador; 3–10 s de retraso, se avisa en la UI.
- **Discord**: no soportado directo. Opción: capturar la ventana en la PC de producción y meterla como cámara local (v1.1), o migrar al jugador a VDO.Ninja.

**Páginas (servidas localmente):**
- `/control`: panel del operador. Multiview en grilla, fila de Preview y Program, botones CUT / FADE, panel de gráficos (GC con nombre, marcador).
- `/program`: salida limpia a 1920×1080, sin interfaz. Es lo que OBS carga como Browser Source.

**Layout del multiview (confirmado por el usuario):** fila superior con PREVIEW y PROGRAM grandes; debajo las 8 cámaras y el VTR en tiles chicos. Preview y Program son espejos de una fuente elegida, no fuentes nuevas.

**Cuidado con conexiones duplicadas:** cada página que abre un link de VDO.Ninja crea su propia conexión WebRTC al jugador. `/program` solo debe conectar la fuente al aire y la que entra en el fade (no las 8), para no duplicar la subida de cada jugador. Los tiles Preview/Program de `/control` deben reutilizar el stream de los tiles de cámara cuando sea posible. A validar en un prototipo antes del resto.

**Estado y comunicación:** un pequeño servidor local mantiene el estado (cámara en preview/program, gráficos visibles) y lo transmite por WebSocket a `/control` y `/program`. El macropad solo manda acciones al servidor.

**Macropad:** el Redragon se asigna a teclas/atajos; el programa escucha atajos globales (o el servidor expone un endpoint por tecla). Mapeo configurable: tecla → cámara N, CUT, FADE, mostrar/ocultar GC.

**Gráficos:** plantillas HTML/CSS con animaciones de entrada/salida, editables sin recompilar (nombres de jugadores y logos desde un archivo de configuración).

**GC con preview (pedido por el usuario):** cada gráfico tiene tres estados: apagado, en preview y al aire. El operador arma un GC (elige plantilla y equipo/jugador), lo ve sobre el tile PREVIEW sin que salga a la transmisión, y cuando está bien lo lanza al program con un botón (con su animación de entrada); otro botón lo baja. Es independiente del cambio de cámara: se puede tener un GC al aire mientras se cambia de cámara, y preparar el siguiente en preview. Detalle de mi propuesta: el tile PREVIEW muestra la fuente en preview con el GC en preview encima; el tile PROGRAM muestra lo mismo que `/program`. Atajos del macropad: "GC a preview", "GC al aire" y "bajar GC".

## Respuestas del usuario (2026-11-21)
- **Entrada:** VDO.Ninja dentro del programa, no en OBS. OBS solo recibe el `/program` ya terminado.
- **Audio:** el caster va aparte (en OBS). De las cámaras, el operador elige cuál es el **audio master** (independiente de la cámara al aire); las demás quedan silenciadas. El VTR suena solo cuando se activa.
- **Gráficos:** marcadores, tabla de posiciones y transiciones. La tabla a pantalla completa sale por el **VTR**, que además guarda logos y demás; el operador elige qué sale. El logo de emergencia es un elemento fijo siempre disponible.
- **Look:** el programa carga marcas/logos conforme se tengan; yo elijo los colores. Tema oscuro, colores apagados (nada muy vivo) para no molestar en las noches.
- **Retraso entre cámaras:** VDO.Ninja dentro del programa es lo más rápido posible (WebRTC). No hay una opción mejor para Twitch/Discord; el retraso de Twitch se avisa en la UI.
- **PC de producción (revisada):** Ryzen 5 3600 (6C/12T), RTX 3060 12 GB, 32 GB RAM, Windows 11 Pro.

## Más respuestas del usuario
- **Casters en OBS:** confirmado, el audio/cámara de los casters se mezcla en OBS.
- **VTR:** se deja cargado de antemano con logos y videos de intro; el operador elige qué sale.
- **Marcador en vivo:** debe poder editarse mientras se transmite, idealmente por otra persona. Forma exacta pendiente (ver Pendiente).
- **VDO.Ninja:** se usa dentro del programa. El programa genera los links de envío para cada equipo y recibe con los links de vista (iframe + API de VDO.Ninja para volumen/mute/calidad). Se usa el servicio público; autoalojarlo queda como opción futura.

## Rendimiento (según la PC revisada)
- Alcanza para 8 cámaras + VTR si cada cámara llega a **720p y ~2–4 Mbps** y los tiles chicos del multiview usan baja resolución. El punto débil es la CPU (Ryzen 3600); la RTX 3060 hace la decodificación de video por hardware y OBS codifica con NVENC, así que la CPU queda libre para el programa.
- Bajada de red necesaria: unos 25–35 Mbps para 8 cámaras a 4 Mbps.
- Perfiles de rendimiento configurables (por ejemplo "720p / 480p en tiles") para que sirva en PCs más modestas.
- Esto es una estimación; se confirma con el prototipo.

## Decidido por mí (para que lo revises)
- Servidor local en Node.js con WebSocket; front en HTML/JS sin framework pesado.
- Confirmado por el usuario: 8 equipos de 2 personas, con **1 señal por equipo** = 8 cámaras. Se agrega **1 fuente VTR** (reproductor de videos/clips para lanzar al aire), total 9 fuentes en el switcher.
- El VTR es una fuente más del switcher: carga una lista de archivos de video locales, con play/pausa/siguiente desde `/control`, y se corta o hace fade a él como a cualquier cámara. Mi propuesta: la lista sale de una carpeta `vtr/`.
- Config de equipos en un archivo JSON (nombre del equipo, 2 jugadores, link de VDO.Ninja o canal de Twitch, logo).
- Atajos del macropad como teclas de teclado normales, hasta confirmar el modelo exacto.

## Pendiente para el constructor
- Probar rendimiento con 8 iframes de VDO.Ninja a 720p más el VTR en la PC real.
- Cómo se manda el audio master a OBS (el `/program` debe sacar solo el audio de la cámara master + VTR).
- Decidir cómo se captura el macropad si no manda teclas estándar.
- Definir el diseño visual de los gráficos con el usuario.
- Marcador y tabla: **decidido por el usuario, vienen de Google Sheets** (todos están en lugares distintos). Detalles míos a confirmar en el plan: la hoja se comparte como "cualquiera con el link puede ver" y los editores tienen permiso de edición; el programa la lee con la API de Google Sheets (clave de API) cada 2–5 s, porque la opción "publicar en la web" puede tardar minutos en actualizar. La tabla de posiciones se calcula con fórmulas en la hoja y el programa solo muestra. Si se cae el internet, el programa deja el último dato recibido y avisa en `/control`. Se puede crear una hoja plantilla con las columnas fijas (equipo, puntos, posición, etc.).
