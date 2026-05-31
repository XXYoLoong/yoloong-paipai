@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0"

echo ================================================================
echo  游龙排排 · 一键启动器
echo  首次启动会自动准备 Node.js / pnpm 并安装依赖，请耐心等待。
echo  本项目是 Node.js 应用，无需安装 Python。
echo ================================================================
echo.

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
echo 启动失败，退出码：%EXIT_CODE%
echo 请查看本目录下 logs\startup.log 或 logs\startup-status.txt。
echo 若是 SearXNG 失败：打开 Docker Desktop，等待引擎就绪后重新运行本脚本。
echo ================================================================
echo.
pause
exit /b %EXIT_CODE%

:end
if exist "logs\startup-status.txt" (
  echo.
  echo ================================================================
  echo 启动流程结束，状态详情见 logs\startup-status.txt
  echo ================================================================
  type "logs\startup-status.txt"
  findstr /C:"searxngReady=False" "logs\startup-status.txt" >nul
  if not errorlevel 1 (
    echo.
    echo [提醒] SearXNG 尚未就绪，联网搜索会降级，直到修复 Docker。
    echo 打开 Docker Desktop，等待引擎就绪后重新运行本脚本即可。
    echo 网页首页会显示黄色/红色提示条与修复步骤。
  ) else (
    echo.
    echo [就绪] SearXNG 已就绪，可在首页勾选「启用本地 SearXNG 搜索」。
  )
  echo ================================================================
  echo.
)

endlocal
