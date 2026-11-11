@echo off
chcp 65001 >nul
title Detener Orderly POS

echo Cerrando servidor de Orderly POS (puerto 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Orderly POS detenido correctamente.
timeout /t 2 >nul
