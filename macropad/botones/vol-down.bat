@echo off
rem Multicam: vol-down. Funciona aunque el foco esté en OBS. Puerto distinto: variable MULTICAM_PORT.
if "%MULTICAM_PORT%"=="" set MULTICAM_PORT=3000
curl.exe -s -X POST http://127.0.0.1:%MULTICAM_PORT%/api/do/vol-down >nul
