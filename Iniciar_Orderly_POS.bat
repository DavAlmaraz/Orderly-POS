@echo off
chcp 65001 >nul
title Orderly POS - Inicio Rapido
color 0F

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

echo ============================================================
echo   ORDERLY POS - Sistema de Gestion Restaurantera
echo ============================================================
echo.

REM 1. Detectar Node.js del sistema o copia portable
set "NODE_EXE=node"
where node >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;%PATH%"
    ) else if exist "C:\Users\pmiki\.gemini\antigravity\brain\43030b05-08f2-4c63-8853-8d4eb0ee06a6\scratch\node\node-v22.14.0-win-x64\node.exe" (
        set "PATH=C:\Users\pmiki\.gemini\antigravity\brain\43030b05-08f2-4c63-8853-8d4eb0ee06a6\scratch\node\node-v22.14.0-win-x64;%PATH%"
    ) else (
        echo [ERROR] No se encontro Node.js instalado en esta computadora.
        echo Descargue Node.js LTS desde https://nodejs.org/ e intente de nuevo.
        pause
        exit /b 1
    )
)

REM 2. Verificar dependencias del backend
if not exist "%ROOT_DIR%\backend\node_modules" (
    echo [1/3] Instalando dependencias del servidor...
    pushd "%ROOT_DIR%\backend"
    call npm install
    popd
)

REM 3. Verificar compilacion del frontend si aun no existe dist
if not exist "%ROOT_DIR%\frontend\dist\index.html" (
    echo [2/3] Preparando interfaz web de Orderly POS...
    if not exist "%ROOT_DIR%\frontend\node_modules" (
        pushd "%ROOT_DIR%\frontend"
        call npm install
        popd
    )
    pushd "%ROOT_DIR%\frontend"
    call npm run build
    popd
)

REM 4. Liberar puerto 3000 si hubiera una instancia previa abierta
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [3/3] Iniciando servidor Orderly POS en puerto 3000...
start "Orderly POS Servidor" /MIN cmd /c "cd /d "%ROOT_DIR%\backend" && node index.js"

timeout /t 2 /nobreak >nul

REM Obtener IP local Wi-Fi/Ethernet para mostrar al usuario
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1" %%x in ("%%i") do (
        echo  - En esta computadora:  http://localhost:3000/login
        echo  - En celular / tableta: http://%%x:3000/login
        goto :ip_mostrada
    )
)
:ip_mostrada

echo.
echo Abriendo Orderly POS en su navegador predeterminado...
start "" "http://localhost:3000/login"

echo.
echo Orderly POS esta en ejecucion. Para apagarlo ejecute Detener_Orderly_POS.bat.
pause
