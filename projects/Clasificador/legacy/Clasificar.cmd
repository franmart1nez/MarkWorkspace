@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
title Clasificador de imagenes

where python >nul 2>nul || (
    echo No se encuentra Python. Instalalo desde https://www.python.org/ y marca "Add to PATH".
    pause
    exit /b 1
)

where opencode >nul 2>nul || (
    echo No se encuentra OpenCode. Instalalo e inicia sesion con tu cuenta Go.
    pause
    exit /b 1
)

python "clasificador de imagenes.py"
echo.
pause
