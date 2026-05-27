$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
$env:PYTHONUTF8 = "1"

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot
$LogDir = Join-Path $ProjectRoot "logs"
$LogPath = Join-Path $LogDir "startup.log"
$FallbackLogPath = Join-Path $LogDir ("startup-fallback-{0}-{1}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"), $PID)
$WebUrl = "http://localhost:3000"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Add-StartupLog {
  param([string[]]$Value)

  try {
    Add-Content -LiteralPath $LogPath -Value $Value -Encoding utf8
    return
  } catch {
  }

  if ($LogPath -ne $FallbackLogPath) {
    $script:LogPath = $FallbackLogPath
  }

  try {
    Add-Content -LiteralPath $LogPath -Value $Value -Encoding utf8
  } catch {
  }
}

function Test-WebReady {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-Command {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Open-WebWhenReady {
  param([string]$Url)

  $script = @"
`$url = '$Url'
for (`$i = 0; `$i -lt 90; `$i++) {
  try {
    `$response = Invoke-WebRequest -Uri `$url -UseBasicParsing -TimeoutSec 2
    if (`$response.StatusCode -ge 200 -and `$response.StatusCode -lt 500) {
      Start-Process `$url
      exit 0
    }
  } catch {
  }
  Start-Sleep -Seconds 1
}
exit 1
"@
  $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($script))
  Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encoded) -WindowStyle Hidden | Out-Null
}

function Get-LocalEnv {
  param([string]$Name)

  $processValue = [Environment]::GetEnvironmentVariable($Name, "Process")
  if (-not [string]::IsNullOrWhiteSpace($processValue)) {
    return $processValue.Trim()
  }

  $userValue = [Environment]::GetEnvironmentVariable($Name, "User")
  if (-not [string]::IsNullOrWhiteSpace($userValue)) {
    return $userValue.Trim()
  }

  $machineValue = [Environment]::GetEnvironmentVariable($Name, "Machine")
  if (-not [string]::IsNullOrWhiteSpace($machineValue)) {
    return $machineValue.Trim()
  }

  return $null
}

function Use-LocalEnv {
  param(
    [string]$Name,
    [string]$Fallback = ""
  )

  $value = Get-LocalEnv $Name
  if ([string]::IsNullOrWhiteSpace($value)) {
    $value = $Fallback
  }
  if (-not [string]::IsNullOrWhiteSpace($value)) {
    [Environment]::SetEnvironmentVariable($Name, $value, "Process")
    Set-Item -Path "env:$Name" -Value $value
  }
  return $value
}

try {
Add-StartupLog @(
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Startup requested."
  "ProjectRoot: $ProjectRoot"
  ""
)

Write-Host "游龙排排一键启动器" -ForegroundColor Green
Write-Host "项目目录：$ProjectRoot"

Write-Step "检查 DeepSeek 本地环境变量"
$deepSeekKey = Use-LocalEnv "DEEPSEEK_API_KEY"
if ([string]::IsNullOrWhiteSpace($deepSeekKey)) {
  Write-Host "未检测到 DEEPSEEK_API_KEY。已检查当前进程、Windows 用户环境变量、Windows 系统环境变量。" -ForegroundColor Red
  Write-Host "请手动增加本地环境变量后重新启动：" -ForegroundColor Yellow
  Write-Host 'setx DEEPSEEK_API_KEY "你的 DeepSeek Key"' -ForegroundColor Yellow
  Write-Host "注意：setx 只影响新打开的终端窗口，设置后请重新双击启动脚本。" -ForegroundColor Yellow
  throw "没有配置 DeepSeek 密钥，已停止启动。"
} else {
  Write-Host "已检测到 DEEPSEEK_API_KEY，并已注入当前启动进程；不会写入项目文件。" -ForegroundColor Green
}

Use-LocalEnv "DEEPSEEK_BASE_URL" "https://api.deepseek.com" | Out-Null
$model = Use-LocalEnv "DEEPSEEK_MODEL"
if ([string]::IsNullOrWhiteSpace($model)) {
  $textModel = Get-LocalEnv "DEEPSEEK_TEXT_MODEL"
  if ([string]::IsNullOrWhiteSpace($textModel)) {
    $textModel = "deepseek-v4-flash"
  }
  [Environment]::SetEnvironmentVariable("DEEPSEEK_MODEL", $textModel, "Process")
  $env:DEEPSEEK_MODEL = $textModel
}
Use-LocalEnv "DEEPSEEK_HIGH_QUALITY_MODEL" "deepseek-v4-pro" | Out-Null

$env:SEARXNG_URL = "http://localhost:8080"
$env:DATABASE_URL = "file:./data/youlong.sqlite"

Write-Step "检查 Web 服务状态"
if (Test-WebReady $WebUrl) {
  Write-Host "Web 服务已经在运行：$WebUrl" -ForegroundColor Green
  Write-Host "正在打开浏览器。关闭此窗口不会停止已经运行的服务。" -ForegroundColor Green
  Start-Process $WebUrl
  Add-StartupLog @(
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Web already running; opened browser."
    "Url: $WebUrl"
    ""
  )
  exit 0
}

Write-Step "检查依赖工具"
if (-not (Test-Command "node")) {
  throw "未找到 node。请先安装 Node.js。"
}
if (-not (Test-Command "pnpm")) {
  if (Test-Command "corepack") {
    Write-Host "未找到 pnpm，正在尝试通过 corepack 启用 pnpm..."
    corepack enable
  } else {
    throw "未找到 pnpm，也未找到 corepack。请先安装 pnpm。"
  }
}

Write-Step "安装/校验前端依赖"
pnpm install

Write-Step "启动本地 SearXNG"
if (Test-Command "docker") {
  try {
    docker compose up -d searxng
    if ($LASTEXITCODE -eq 0) {
      Write-Host "SearXNG 已启动：http://localhost:8080" -ForegroundColor Green
    } else {
      Write-Host "SearXNG 未能启动。请确认 Docker Desktop 已启动；Web 会继续启动，但联网搜索不可用。" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "Docker 已安装但 SearXNG 启动失败。请确认 Docker Desktop 已启动。" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
  }
} else {
  Write-Host "未检测到 docker。将继续启动 Web，但联网搜索不可用。" -ForegroundColor Yellow
}

Write-Step "启动 Next.js 开发服务"
Write-Host "Web 地址：$WebUrl" -ForegroundColor Green
Write-Host "SearXNG 地址：http://localhost:8080" -ForegroundColor Green
Write-Host "按 Ctrl+C 可停止 Web 服务。"
Write-Host "浏览器会在 Web 服务就绪后自动打开。" -ForegroundColor Green
Open-WebWhenReady $WebUrl
Add-StartupLog @(
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Starting Next.js dev server."
  "Url: $WebUrl"
  ""
)

pnpm dev
} catch {
  Write-Host ""
  Write-Host "启动失败：$($_.Exception.Message)" -ForegroundColor Red
  Write-Host "日志位置：$LogPath" -ForegroundColor Yellow
  Add-StartupLog @(
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Startup failed."
    "Reason: $($_.Exception.Message)"
    ""
  )
  exit 1
}
