$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
$env:PYTHONUTF8 = "1"

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot
$LogDir = Join-Path $ProjectRoot "logs"
$LogPath = Join-Path $LogDir "startup.log"
$StatusPath = Join-Path $LogDir "startup-status.txt"
$FallbackLogPath = Join-Path $LogDir ("startup-fallback-{0}-{1}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"), $PID)
$WebUrl = "http://localhost:3000"
$SearXngUrl = "http://localhost:8080"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$script:SearXngReady = $false
$script:SearXngMessage = "尚未检测"

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

function Write-StartupStatus {
  param([string[]]$Lines)
  try {
    Set-Content -LiteralPath $StatusPath -Value $Lines -Encoding utf8
  } catch {
  }
}

function Test-WebReady {
  param(
    [string]$Url,
    [int]$Retries = 3,
    [int]$TimeoutSec = 5
  )

  for ($attempt = 0; $attempt -lt $Retries; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
    }
    if ($attempt -lt ($Retries - 1)) {
      Start-Sleep -Seconds 1
    }
  }

  return $false
}

function Test-DevServerRunning {
  param([string]$Url = $WebUrl)

  if (Test-WebReady $Url) {
    return $true
  }

  try {
    $health = Invoke-RestMethod -Uri "$Url/api/tools/health" -TimeoutSec 8
    return [bool]$health.generatedAt
  } catch {
    return $false
  }
}

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Banner {
  param(
    [string]$Title,
    [string[]]$Lines,
    [string]$Color = "Yellow"
  )

  Write-Host ""
  Write-Host ("=" * 72) -ForegroundColor $Color
  Write-Host $Title -ForegroundColor $Color
  Write-Host ("=" * 72) -ForegroundColor $Color
  foreach ($line in $Lines) {
    Write-Host $line -ForegroundColor $Color
  }
  Write-Host ("=" * 72) -ForegroundColor $Color
  Write-Host ""
}

function Test-Command {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Resolve-DockerExecutable {
  $command = Get-Command docker -ErrorAction SilentlyContinue
  if ($command -and $command.Source) {
    return $command.Source
  }

  $candidates = @(
    (Join-Path $env:ProgramFiles "Docker\Docker\resources\bin\docker.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Docker\Docker\resources\bin\docker.exe")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Invoke-DockerCommand {
  param(
    [string]$DockerExe,
    [string[]]$Arguments
  )

  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $DockerExe @Arguments 2>&1 | Out-Null
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
}

function Test-DockerDaemon {
  param([string]$DockerExe)

  return (Invoke-DockerCommand $DockerExe @("info")) -eq 0
}

function Start-DockerDesktop {
  $desktopExe = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path $desktopExe)) {
    return $false
  }

  Write-Host "正在启动 Docker Desktop，请等待引擎就绪…" -ForegroundColor Yellow
  Start-Process -FilePath $desktopExe | Out-Null
  return $true
}

function Wait-DockerDaemon {
  param(
    [string]$DockerExe,
    [int]$TimeoutSec = 120
  )

  for ($i = 0; $i -lt $TimeoutSec; $i++) {
    if (Test-DockerDaemon $DockerExe) {
      return $true
    }
    if ($i -gt 0 -and ($i % 10) -eq 0) {
      Write-Host "仍在等待 Docker 引擎… ($i/$TimeoutSec 秒)" -ForegroundColor DarkYellow
    }
    Start-Sleep -Seconds 1
  }

  return $false
}

function Test-SearXngReady {
  try {
    $url = "$SearXngUrl/search?q=youlong-paipai-health&format=json"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 4
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Start-SearXngService {
  param([string]$DockerExe)

  Write-Host "正在启动 SearXNG 容器（docker compose up -d searxng）…" -ForegroundColor Cyan
  $exitCode = Invoke-DockerCommand $DockerExe @("compose", "up", "-d", "searxng")
  if ($exitCode -ne 0) {
    return "docker compose 启动失败，退出码 $exitCode"
  }

  for ($i = 0; $i -lt 45; $i++) {
    if (Test-SearXngReady) {
      return $null
    }
    if ($i -gt 0 -and ($i % 5) -eq 0) {
      Write-Host "等待 SearXNG 就绪… ($i/45 秒)" -ForegroundColor DarkYellow
    }
    Start-Sleep -Seconds 1
  }

  return "容器已启动，但 $SearXngUrl 仍无 JSON 响应"
}

function Ensure-SearXngReady {
  $dockerExe = Resolve-DockerExecutable
  if (-not $dockerExe) {
    $script:SearXngMessage = "未安装 Docker Desktop，无法启动联网搜索。"
    Write-Banner "联网搜索未就绪" @(
      "未找到 docker 命令，也未在 Program Files 中发现 Docker Desktop。"
      "请安装 Docker Desktop 后重新运行 start-youlong-paipai.bat。"
      "在未安装 Docker 时，仍可本地拆解计划，但无法联网查询公开资料。"
    ) "Red"
    return $false
  }

  Write-Host "已找到 Docker：$dockerExe" -ForegroundColor Green

  if (-not (Test-DockerDaemon $dockerExe)) {
    if (-not (Start-DockerDesktop)) {
      $script:SearXngMessage = "Docker Desktop 未运行且无法自动启动。"
      Write-Banner "Docker 未运行" @(
        "请先手动打开 Docker Desktop，等待 Engine running 后再重新双击启动脚本。"
      ) "Red"
      return $false
    }

    if (-not (Wait-DockerDaemon $dockerExe 120)) {
      $script:SearXngMessage = "Docker Desktop 启动超时（120 秒）。"
      Write-Banner "Docker 启动超时" @(
        "Docker Desktop 已尝试启动，但 120 秒内引擎仍未就绪。"
        "请打开 Docker Desktop 查看是否卡在初始化/WSL，就绪后重新运行 bat。"
      ) "Red"
      return $false
    }
  }

  Write-Host "Docker 引擎已就绪。" -ForegroundColor Green

  if (Test-SearXngReady) {
    $script:SearXngReady = $true
    $script:SearXngMessage = "SearXNG 已在运行：$SearXngUrl"
    Write-Host $script:SearXngMessage -ForegroundColor Green
    return $true
  }

  $startError = Start-SearXngService $dockerExe
  if ($startError) {
    $script:SearXngMessage = $startError
    Write-Banner "SearXNG 启动失败" @(
      $startError
      "请执行：docker compose logs searxng"
      "网页首页会显示黄色提示；设置页健康检查也会标红/黄。"
      "修复前勾选「启用本地 SearXNG 搜索」只会降级，无法真正联网。"
    ) "Red"
    return $false
  }

  $script:SearXngReady = $true
  $script:SearXngMessage = "SearXNG 已启动并就绪：$SearXngUrl"
  Write-Host $script:SearXngMessage -ForegroundColor Green
  return $true
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
  # 关键：没有密钥不阻塞启动。应用会自动降级为「本地基础拆解」，全新电脑也能一键跑起来。
  Write-Banner "未配置 DeepSeek 密钥（不影响启动）" @(
    "未检测到 DEEPSEEK_API_KEY，应用将自动使用「本地基础拆解」继续运行，可正常演示。"
    "如需更高质量的 AI 拆解，请配置密钥后重启脚本："
    '  setx DEEPSEEK_API_KEY "你的 DeepSeek Key"'
    "提示：setx 只对新打开的窗口生效，设置后请重新双击启动脚本。"
  ) "Yellow"
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

$env:SEARXNG_URL = $SearXngUrl
$env:DATABASE_URL = "file:./data/youlong.sqlite"

Write-Step "启动 Docker 与本地 SearXNG（联网搜索必需）"
$searxngOk = Ensure-SearXngReady

Write-StartupStatus @(
  "generatedAt=$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  "searxngReady=$searxngOk"
  "searxngMessage=$script:SearXngMessage"
  "webUrl=$WebUrl"
)

Write-Step "检查 Web 服务状态"
if (Test-DevServerRunning $WebUrl) {
  Write-Host "Web 服务已经在运行：$WebUrl" -ForegroundColor Green
  if (-not $searxngOk) {
    Write-Banner "提醒：联网搜索未就绪" @(
      $script:SearXngMessage
      "网页首页顶部会显示黄色/红色提示条。"
      "请修复 Docker/SearXNG 后再勾选「启用本地 SearXNG 搜索」。"
    ) "Yellow"
  } else {
    Write-Host "联网搜索状态：$script:SearXngMessage" -ForegroundColor Green
  }
  Write-Host "正在打开浏览器。关闭此窗口不会停止已经运行的服务。" -ForegroundColor Green
  Start-Process $WebUrl
  Add-StartupLog @(
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Web already running; opened browser."
    "SearXNG ready: $searxngOk"
    "Url: $WebUrl"
    ""
  )
  exit 0
}

Write-Step "检查并准备运行环境（Node.js / pnpm）"

# 把最新的「机器级 + 用户级」PATH 同步进当前进程，确保刚安装的 node/pnpm 立刻可用
function Update-ProcessPath {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ";"
}

# 零环境兜底：老师机器可能完全没有 Node.js，这里尝试用 winget 自动安装 22 LTS
if (-not (Test-Command "node")) {
  Write-Host "未检测到 Node.js，正在尝试自动安装 Node.js 22 LTS…" -ForegroundColor Yellow
  if (Test-Command "winget") {
    try {
      winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
    } catch {
      Write-Host "winget 安装 Node.js 时出现异常：$($_.Exception.Message)" -ForegroundColor DarkYellow
    }
    Update-ProcessPath
    # 兜底：刚装好的 Node 可能尚未刷新到当前进程 PATH，直接补上标准安装目录
    $nodeDir = Join-Path $env:ProgramFiles "nodejs"
    if (Test-Path (Join-Path $nodeDir "node.exe")) {
      $env:Path = "$nodeDir;$env:Path"
    }
  } else {
    Write-Host "系统未提供 winget，无法自动安装。" -ForegroundColor DarkYellow
  }
}

if (-not (Test-Command "node")) {
  Write-Banner "缺少 Node.js 运行环境" @(
    "未能自动安装 Node.js。请手动安装后重新双击 start-youlong-paipai.bat："
    "  1) 打开 https://nodejs.org/zh-cn 下载并安装 Node.js 22 LTS（一路「下一步」即可）；"
    "  2) 安装完成后请关闭所有终端，再重新双击 start-youlong-paipai.bat。"
    "说明：本项目是 Node.js / Next.js 应用，运行时只依赖 Node.js，无需安装 Python。"
  ) "Red"
  try { Start-Process "https://nodejs.org/zh-cn" | Out-Null } catch {}
  throw "未安装 Node.js，已停止启动。"
}

Write-Host "Node.js 版本：$(node -v)" -ForegroundColor Green

# 通过 corepack 激活与 package.json 中 packageManager 对齐的 pnpm 版本，避免污染全局
if (Test-Command "corepack") {
  try {
    corepack enable | Out-Null
    corepack prepare pnpm@11.1.2 --activate | Out-Null
  } catch {
    Write-Host "corepack 准备 pnpm 时出现告警：$($_.Exception.Message)" -ForegroundColor DarkYellow
  }
  Update-ProcessPath
}

# corepack 不可用时，退而求其次用 npm 安装 pnpm
if (-not (Test-Command "pnpm") -and (Test-Command "npm")) {
  Write-Host "未找到 pnpm，正在通过 npm 安装 pnpm…" -ForegroundColor Yellow
  npm install -g pnpm@11.1.2 | Out-Null
  Update-ProcessPath
}

if (-not (Test-Command "pnpm")) {
  throw "未能自动准备 pnpm。请在终端执行：npm install -g pnpm，然后重新双击启动脚本。"
}

Write-Host "pnpm 版本：$(pnpm -v)" -ForegroundColor Green

Write-Step "安装/校验前端依赖"
pnpm install
if ($LASTEXITCODE -ne 0) {
  throw "pnpm install 失败，退出码 $LASTEXITCODE"
}

Write-Step "校验原生模块（better-sqlite3）"
node (Join-Path $ProjectRoot "scripts\ensure-native-modules.mjs")
if ($LASTEXITCODE -ne 0) {
  throw "better-sqlite3 与当前 Node 不兼容且自动修复失败。请在项目目录执行：pnpm rebuild better-sqlite3"
}

Write-Step "启动 Next.js 开发服务"
Write-Host "Web 地址：$WebUrl" -ForegroundColor Green
Write-Host "SearXNG 地址：$SearXngUrl" -ForegroundColor Green
if ($searxngOk) {
  Write-Host "联网搜索：已就绪，可在首页勾选 SearXNG 后生成计划。" -ForegroundColor Green
} else {
  Write-Banner "联网搜索未就绪（Web 仍会启动）" @(
    $script:SearXngMessage
    "首页会显示明显提示条；未修复前只能本地拆解，无法联网查资料。"
    "状态文件：$StatusPath"
  ) "Yellow"
}
Write-Host "按 Ctrl+C 可停止 Web 服务。"
Write-Host "浏览器会在 Web 服务就绪后自动打开。" -ForegroundColor Green
Open-WebWhenReady $WebUrl
Add-StartupLog @(
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Starting Next.js dev server."
  "SearXNG ready: $searxngOk"
  "Url: $WebUrl"
  ""
)

pnpm dev
} catch {
  Write-Host ""
  Write-Host "启动失败：$($_.Exception.Message)" -ForegroundColor Red
  Write-Host "日志位置：$LogPath" -ForegroundColor Yellow
  Write-Host "状态文件：$StatusPath" -ForegroundColor Yellow
  Add-StartupLog @(
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Startup failed."
    "Reason: $($_.Exception.Message)"
    ""
  )
  exit 1
}
