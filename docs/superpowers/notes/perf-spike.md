# Prueba de rendimiento (Task 4) — PENDIENTE DE MEDIR

Cómo: `npm start`, abrir `http://localhost:3000/spike/?rooms=sala1,...,sala8` con 8 emisores
de VDO.Ninja enviando a 720p (link `https://vdo.ninja/?push=salaN&quality=1`).

Medir en el Administrador de tareas (CPU, GPU "Video Decode") durante 5 minutos, y el fps del HUD.
Además abrir `/program` y comprobar en cuántas conexiones sube cada emisor (stats de VDO.Ninja).

Criterio (del plan): CPU sostenida < 70 % y sin cortes -> seguir. Si no: bajar tiles a 360p/480p
o pasar a la opción 3 (escritorio con NDI) y avisar.

También confirmar que `&quality=1` es 720p en el emisor.

| Fecha | CPU % | GPU decode % | fps HUD | Cortes | Veredicto |
|-------|-------|--------------|---------|--------|-----------|
|       |       |              |         |        |           |
