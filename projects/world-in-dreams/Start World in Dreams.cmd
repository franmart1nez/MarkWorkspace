@echo off
rem Starts the local viewer and opens it in the default browser.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is required: https://nodejs.org & pause & exit /b 1)
start "" http://localhost:5179
node server.mjs 5179
