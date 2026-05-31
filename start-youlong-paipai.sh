#!/usr/bin/env bash
# 游龙排排一键启动器（macOS / Linux）
# 本项目是 Node.js / Next.js 应用，运行时只依赖 Node.js，无需安装 Python。
set -euo pipefail

cd "$(dirname "$0")"

echo "================================================================"
echo " 游龙排排 · 一键启动器"
echo " 首次启动会自动准备 pnpm 并安装依赖，请耐心等待。"
echo "================================================================"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js。请先安装 Node.js 22 LTS：https://nodejs.org/zh-cn"
  echo "  - macOS 可用：brew install node@22"
  echo "  - 安装后重新运行本脚本：bash start-youlong-paipai.sh"
  exit 1
fi
echo "Node.js 版本：$(node -v)"

# 通过 corepack 激活与 package.json 对齐的 pnpm 版本
if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
  corepack prepare pnpm@11.1.2 --activate >/dev/null 2>&1 || true
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "未找到 pnpm，正在通过 npm 安装…"
  npm install -g pnpm@11.1.2
fi
echo "pnpm 版本：$(pnpm -v)"

export SEARXNG_URL="${SEARXNG_URL:-http://localhost:8080}"
export DATABASE_URL="${DATABASE_URL:-file:./data/youlong.sqlite}"

echo "==> 安装/校验依赖"
pnpm install

echo "==> 校验原生模块（better-sqlite3）"
node scripts/ensure-native-modules.mjs || pnpm rebuild better-sqlite3

echo "==> 启动 Next.js 开发服务（http://localhost:3000）"
echo "如需联网搜索，请另开终端执行：docker compose up -d searxng"
pnpm dev
