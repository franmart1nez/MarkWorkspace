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
    echo Aviso: no se encuentra OpenCode. Podras organizar el arbol y ver imagenes, pero no usar la IA.
)

python -c "import PIL" >nul 2>nul || (
    echo Instalando Pillow para las miniaturas...
    python -m pip install --user pillow
)

python "app\server.py" %*
echo.
pause
