@echo off
rem Uso: macropad\cmd.bat <comando>   (ej.: cmd.bat cut)   Lista de comandos: ver README.
rem Funciona aunque el foco esté en OBS u otra ventana. Cambia el puerto con MULTICAM_PORT si hace falta.
if "%MULTICAM_PORT%"=="" set MULTICAM_PORT=3000
curl.exe -s -X POST http://127.0.0.1:%MULTICAM_PORT%/api/do/%1 >nul
