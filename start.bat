@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Falta Node.js 20 o superior: https://nodejs.org & pause & exit /b 1)
if not exist node_modules call npm install
if not exist config\teams.json (
  copy config\teams.example.json config\teams.json >nul
  echo Se creo config\teams.json. Editalo con tus equipos y vuelve a abrir este archivo.
  notepad config\teams.json
  pause
  exit /b 0
)
start "Multicam server" cmd /k node server\main.js
timeout /t 2 >nul
rem Se abre como ventana de aplicacion (Edge --app). Si no hay Edge, abre el navegador normal.
start "" msedge --app=http://localhost:3000/control/ 2>nul || start "" http://localhost:3000/control/
