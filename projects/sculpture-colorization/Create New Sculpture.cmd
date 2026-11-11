@echo off
setlocal
python "%~dp0scripts\new_sculpture.py" create
set "SCULPTURE_CREATE_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %SCULPTURE_CREATE_EXIT%
