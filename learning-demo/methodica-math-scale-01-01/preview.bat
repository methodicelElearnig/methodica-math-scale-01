@echo off
REM Dev-only helper: serves this folder over http:// so the YouTube embed on screen 4 works.
REM (YouTube blocks embeds when opened directly as a file:// page — Error 153.)
REM Not needed for the published/delivered lomda — safe to delete before handoff.
cd /d "%~dp0"
start "lomda-preview-server" /min cmd /c "python -m http.server 8123"
ping -n 2 127.0.0.1 >nul
start "" http://localhost:8123/index_dev.html
echo Server is running in a separate minimized window titled "lomda-preview-server".
echo Close that window when you're done to stop the server.
pause
