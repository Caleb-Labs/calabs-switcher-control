@echo off
rem Lanzador del plugin Multicam. Stream Station no trae Node: este .cmd busca un node.exe y arranca plugin.js oculto,
rem pasandole los argumentos del software (-port, -pluginUUID, -registerEvent, -info). Mismo esquema que los plugins de Discord.
setlocal
set "BASE_DIR=%~dp0"
set "NODE_EXE="
if exist "%BASE_DIR%node.exe" set "NODE_EXE=%BASE_DIR%node.exe"
if not defined NODE_EXE for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE for /d %%D in ("%APPDATA%\Elgato\StreamDeck\NodeJS\*") do if exist "%%D\node.exe" set "NODE_EXE=%%D\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE exit /b 1
if not exist "%BASE_DIR%plugin.js" exit /b 1

set "NODE_ARGS="%BASE_DIR%plugin.js" %*"

powershell.exe -NoProfile -WindowStyle Hidden -Command ^
  "Start-Process -FilePath $env:NODE_EXE -ArgumentList $env:NODE_ARGS -WindowStyle Hidden"

endlocal
exit /b 0
