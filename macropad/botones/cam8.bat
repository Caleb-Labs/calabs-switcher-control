@echo off
rem Multicam: cam8. Funciona aunque el foco esté en OBS. Puerto distinto: variable MULTICAM_PORT.
if "%MULTICAM_PORT%"=="" set MULTICAM_PORT=3000
curl.exe -s -X POST http://127.0.0.1:%MULTICAM_PORT%/api/do/cam8 >nul
