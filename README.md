# 游龙排排

基于 `Next.js App Router + React 19 + TypeScript` 的智能任务规划器。用户输入复杂目标后，系统会通过轻量 Agent 状态机拆解任务，按需调用本地 SearXNG 查询公开信息，再生成可编辑、可拖拽、可导出的 To-do List。

**仓库**：https://github.com/XXYoLoong/yolong-paipai

## 技术栈

- Web：Next.js 16、React 19、TypeScript、Tailwind CSS v4
- Agent：DeepSeek Chat Completion API、JSON output、Zod 结构化校验
- 搜索：本地 SearXNG JSON API
- 数据：SQLite、Drizzle ORM、better-sqlite3
- 导出：docx、pdf-lib + fontkit（中文 PDF）、ExcelJS、JSZip
- 交互：React Hook Form、@dnd-kit、lucide-react
- 测试：Vitest

## 快速开始

### Windows 一键启动（推荐）

```bat
start-youlong-paipai.bat
```

脚本会自动完成：

1. 从系统/用户环境变量读取 `DEEPSEEK_API_KEY`（**不会**写入项目文件）
2. 检测并尝试启动 Docker Desktop，再 `docker compose up -d searxng`
3. 若 3000 端口已有开发服务则复用，否则启动 `pnpm dev`
4. 写入 `logs/startup.log` 与 `logs/startup-status.txt`，终端打印 SearXNG 就绪状态

密钥读取顺序：当前终端 → Windows 用户变量 → Windows 系统变量。三层都没有时，脚本会停止并提示执行 `setx DEEPSEEK_API_KEY "你的 DeepSeek Key"`。

**SearXNG 未就绪时**：首页与设置页会显示醒目提示；应用仍可用本地基础拆解，联网搜索需修复 Docker 后重新运行 bat。

### 手动开发

```bash
git clone https://github.com/XXYoLoong/youlong-paipai.git
cd youlong-paipai
pnpm install
cp .env.example .env
pnpm dev
```

没有 `DEEPSEEK_API_KEY` 时，应用会自动使用本地基础拆解，方便课堂演示。若要启用联网搜索：

```bash
docker compose up -d searxng
```

并确保 `searxng/settings.yml` 中启用了 `search.formats: [html, json]`。

开发地址：

- Web：http://localhost:3000
- SearXNG：http://localhost:8080
- 健康检查：http://localhost:3000/api/tools/health

本地数据默认写入 `data/youlong.sqlite`（已在 `.gitignore`，首次启动自动建库）。

## Docker 全量部署

```bash
cp .env.example .env
docker compose up --build
```

默认数据保存在 Docker volume `youlong-data` 中，SQLite 路径为 `/data/youlong.sqlite`。

## 核心功能（V2.0）

二期功能（F-01～F-18，不含 F-14 公网部署、F-15 演示视频）已全部落地，详见 [`docs/phase2-completion-audit.md`](docs/phase2-completion-audit.md)。

| 模块 | 能力 |
|------|------|
| 模板库 | 7 类内置场景一键填充目标 |
| Agent 记忆 | 按目标类型检索历史偏好并注入生成 |
| 流式反馈 | SSE 实时展示 `stageLog` 生成阶段 |
| 联网搜索 | SearXNG + 来源可信度（高/中/低/待复核） |
| 任务看板 | 子任务树、拖拽排序、依赖编辑、截止时间 |
| 时间轴 | 主任务按截止时间排序，依赖未满足显示「待前置」 |
| 历史管理 | 搜索、筛选、归档、复制、删除确认 |
| 导出中心 | `/api/export/:planId?format=md\|docx\|pdf\|xlsx\|bundle` |
| 报告助手 | `POST /api/reports/generate` |
| 复盘面板 | 完成率、延期原因、记忆反哺 |
| 设置 | 访问密码、工具健康检查、清库 |
| 质量门禁 | `pnpm check:submit` 提交包检查、AI 使用声明 |

### 近期稳定性改进

- **启动诊断**：Docker 路径探测、引擎等待、SearXNG 探活与首页状态条
- **模型输出**：截断 JSON 修复、解析失败自动 repair、生成后截止时间规范化（不早于今天）
- **依赖映射**：子任务 flatten 后依赖 ID 重映射为真实 UUID
- **Hydration**：按钮 `href` 模式、拖拽延迟挂载、表单受控同步
- **PDF 中文**：内置 `assets/fonts/SimHei.ttf`，导出不再出现问号；亦可放置 `NotoSansSC-Regular.otf` 或依赖系统字体

## 质量命令

```bash
pnpm typecheck
pnpm lint
pnpm test          # 18 项 Vitest
pnpm check:submit  # 拦截 logs/output/.env 等不应提交的内容
pnpm build
```

一键验收（与审计文档一致）：

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm check:submit && pnpm build
```

## 项目结构（简要）

```
src/app/          Next.js 页面与 API 路由
src/components/   规划器、设置、导出等 UI
src/lib/agent/    Agent 编排、Prompt、记忆、JSON 解析
src/lib/export/   md/docx/pdf/xlsx/bundle 导出
assets/fonts/     PDF 中文字体（SimHei.ttf）
scripts/          一键启动、提交包检查
docs/             二期审计、过程日志、AI 声明
```

## 文档

- [二期功能完成度审计](docs/phase2-completion-audit.md)
- [开发过程日志](docs/step-by-step-log.md)
- [AI 工具使用声明](docs/ai-tool-usage-statement.md)

## 隐私策略

- 不接入第三方统计 SDK。
- 用户目标、任务、搜索结果和运行日志只保存到本地数据库。
- DeepSeek API Key 只存在服务端环境变量，不进入浏览器 bundle。
- 启用搜索时，搜索关键词会通过本地 SearXNG 请求外部搜索引擎，建议先脱敏。
