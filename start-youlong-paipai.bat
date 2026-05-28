@echo off
setlocal EnableExtensions

cd /d "%~dp0"
where pwsh.exe >nul 2>nul
if errorlevel 1 goto use_windows_powershell

pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-youlong-paipai.ps1"
goto after_run

:use_windows_powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-youlong-paipai.ps1"

:after_run
set "EXIT_CODE=%ERRORLEVEL%"
if "%EXIT_CODE%"=="0" goto end

echo.
echo ================================================================
echo Startup failed. Exit code: %EXIT_CODE%
echo See logs\startup.log or logs\startup-status.txt in this folder.
echo If SearXNG failed: open Docker Desktop, wait for Engine running,
echo then run this bat again.
echo ================================================================
echo.
pause
exit /b %EXIT_CODE%

:end
if exist "logs\startup-status.txt" (
  echo.
  echo ================================================================
  echo Startup finished. See logs\startup-status.txt
  echo ================================================================
  type "logs\startup-status.txt"
  findstr /C:"searxngReady=False" "logs\startup-status.txt" >nul
  if not errorlevel 1 (
    echo.
    echo [WARNING] SearXNG is NOT ready. Search will be degraded until Docker is fixed.
    echo Open Docker Desktop, wait for Engine running, then run this bat again.
    echo The homepage will show a yellow/red banner with repair steps.
  ) else (
    echo.
    echo [OK] SearXNG is ready. You can enable search on the homepage.
  )
  echo ================================================================
  echo.
)

endlocal
