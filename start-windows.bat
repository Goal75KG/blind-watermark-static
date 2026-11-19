@echo off
cd /d "%~dp0"
where py >nul 2>&1
if not errorlevel 1 (
  py -3 -m http.server 8000 --bind 127.0.0.1 --directory dist
) else (
  python -m http.server 8000 --bind 127.0.0.1 --directory dist
)
pause
