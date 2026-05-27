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
echo Startup failed. Exit code: %EXIT_CODE%
echo See the log path printed above, or check files under logs in this project folder.
echo.
pause
exit /b %EXIT_CODE%

:end

endlocal
