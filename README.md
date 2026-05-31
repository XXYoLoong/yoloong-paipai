# 游龙排排

基于 `Next.js App Router + React 19 + TypeScript` 的智能任务规划器。用户输入复杂目标后，系统会通过轻量 Agent 状态机拆解任务，按需调用本地 SearXNG 查询公开信息，再生成可编辑、可拖拽、可导出的 To-do List。

**仓库**：https://github.com/XXYoLoong/yoloong-paipai

## 技术栈

- Web：Next.js 16、React 19、TypeScript、Tailwind CSS v4
- Agent：DeepSeek Chat Completion API、JSON output、Zod 结构化校验
- 搜索：本地 SearXNG JSON API
- 数据：SQLite、Drizzle ORM、better-sqlite3
- 导出：docx、pdf-lib + fontkit（中文 PDF）、ExcelJS、JSZip
- 交互：React Hook Form、@dnd-kit、lucide-react
- 测试：Vitest

## 运行环境

本项目是**纯 Node.js / Next.js 应用，运行时只依赖 Node.js，不需要安装 Python**。环境通过以下方式锁定（相当于 Node 版的「虚拟环境」隔离）：

- `engines`：限定 Node `>=20 <23`（开发与验收均用 **Node 22 LTS**）
- `packageManager`：固定 `pnpm@11.1.2`（一键脚本通过 `corepack` 自动激活同版本）
- `.nvmrc`：写明 `22`，使用 `nvm` 的同学可 `nvm use`

## 快速开始

### Windows 一键启动（强烈推荐，零环境也能跑）

双击或在终端运行：

```bat
start-youlong-paipai.bat
```

即使是**刚买回来、什么都没装（没有 Node、没有 pnpm、没有 Docker、没有密钥、没有 Python）**的机器，脚本也会自动完成：

1. **检测 Node.js**；缺失时尝试用 `winget` 自动安装 Node.js 22 LTS，并把安装目录补进当前进程 PATH（失败则给出中文指引并自动打开下载页）
2. **准备 pnpm**：通过 Node 自带的 `corepack` 激活与 `package.json` 对齐的 pnpm 版本（必要时回退 `npm i -g pnpm`）
3. **安装全部依赖**（`pnpm install`）并自动校验/重建原生模块 `better-sqlite3`
4. 读取 `DEEPSEEK_API_KEY`（**不会**写入项目文件）；**没有密钥也不会停止**，自动降级为本地基础拆解
5. 检测并尝试启动 Docker Desktop，再 `docker compose up -d searxng`；**没有 Docker 也不会停止**，仅关闭联网搜索并提示
6. 启动 `pnpm dev` 并在就绪后自动打开浏览器；写入 `logs/startup.log` 与 `logs/startup-status.txt`

> 启动脚本顶部已 `chcp 65001`，全程为 **UTF-8 中文提示**，不会乱码。

> **关于装 Node 的唯一边界**：自动安装 Node 依赖系统自带的 `winget`（Win11 与较新的 Win10 都有），过程中**可能弹一次 UAC 授权（点「是」即可）**。极少数没有 `winget` 的老系统需要按提示**手动装一次 Node**（一路「下一步」），装完重新双击 bat 即全自动。**除装 Node 外，密钥 / Docker / pnpm / Python 全都「没有也能一键跑起来」。**

### macOS / Linux 一键启动

```bash
bash start-youlong-paipai.sh
```

同样会自动准备 pnpm、安装依赖、校验原生模块并启动开发服务。

密钥读取顺序：当前终端 → Windows 用户变量 → Windows 系统变量。**三层都没有时不会中断启动**，应用自动降级为本地基础拆解（方便课堂演示）；若需更高质量的 AI 拆解，可执行 `setx DEEPSEEK_API_KEY "你的 DeepSeek Key"` 后重新双击 bat（`setx` 只对新窗口生效）。

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

**Node 升级后首页 500 / `NODE_MODULE_VERSION` 报错**：说明 `better-sqlite3` 原生模块与当前 Node 不匹配。一键启动脚本会自动 `pnpm rebuild better-sqlite3`；也可手动执行 `pnpm ensure:native` 或 `pnpm rebuild better-sqlite3` 后重新运行 bat。

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
| 命令面板 | `⌘K / Ctrl+K` 全局唤起，键盘导航页面、切换主题 |
| 主题 | 白天 / 夜间双主题，跟随选择持久化（默认夜间石墨） |
| 质量门禁 | `pnpm check:submit` 提交包检查、AI 使用声明 |

### 近期稳定性改进

- **启动诊断**：Docker 路径探测、引擎等待、SearXNG 探活与首页状态条
- **模型输出**：截断 JSON 修复、解析失败自动 repair、生成后截止时间规范化（不早于今天）
- **依赖映射**：子任务 flatten 后依赖 ID 重映射为真实 UUID
- **Hydration**：按钮 `href` 模式、拖拽延迟挂载、表单受控同步；时间统一用确定性格式化（`formatStoredDateTime`），不依赖运行环境时区/locale，避免 SSR 与客户端不一致
- **PDF 中文**：内置 `assets/fonts/SimHei.ttf`，导出不再出现问号；亦可放置 `NotoSansSC-Regular.otf` 或依赖系统字体

## 界面与交互（Graphite Command Center）

面向「Agentic 工具」的指挥中心视觉语言，强调控制感、透明度与专业质感，而非堆砌炫彩颜色或线条动效。

- **双主题**：默认夜间「柔化石墨」（非纯黑画布 + 表面层级 surface ladder），可一键切换白天「近白」主题。主题以 CSS 变量整体翻转，所有组件随之换肤；选择写入 `localStorage`，并通过首屏内联脚本提前注入，避免闪烁。切换入口在每个页头的主题按钮，或命令面板。
- **设计令牌**：1px 发丝描边（hairline）替代重投影、克制的单一强调色（refined teal）、低饱和状态色（rose/amber/indigo）、等宽字承载编号/计数/时间等元信息、字距大写的区块小标签（kicker）。
- **指挥台细节**：极淡网格 + 顶部强调晕影的画布纹理、脉冲状态点、品牌名渐变、强调按钮辉光、卡片发丝高光与柔投影。
- **命令面板（⌘K / Ctrl+K）**：全局唤起，支持模糊搜索、`↑↓` 选择、`↵` 执行、`Esc` 关闭；内置页面导航与主题切换命令。
- **信息结构**：首页「Intent Console / 命令栏」、生成过程「Live Runway」竖向轨道、计划详情「Mission Board」与依赖时间轴「Dependency Rail」（节点 + 等宽编号）。

实现集中在 `src/app/globals.css`（令牌与双主题）、`src/components/ui/*`（原语）与 `src/components/system/*`（主题切换、命令面板）。

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
src/components/   规划器、设置、导出、系统级（主题/命令面板）UI
src/lib/agent/    Agent 编排、Prompt、记忆、JSON 解析
src/lib/search/   SearXNG 客户端与来源可信度分级
src/lib/export/   md/docx/pdf/xlsx/bundle 导出
src/lib/db/       Drizzle schema、查询与初始化
assets/fonts/     PDF 中文字体（SimHei.ttf）
scripts/          一键启动、原生模块自检、提交检查、报告与提交包生成
docs/             审计、过程日志、AI 声明、项目计划书 PDF 与报告插图
```

## 项目报告与提交包

- **项目计划书（含 AI 使用声明）PDF**：`docs/游龙排排-项目计划书.pdf`
  - 正文为项目报告（项目背景、需求、技术选型、架构与数据模型/ER 图、Agent 实现细节、功能与界面截图、工程质量、问题与解决、部署、总结展望）；末章为独立的「AI 工具使用声明（开发过程）」。
  - 重新生成：`pnpm report:pdf`（复用项目内的 pdf-lib 与中文字体，无需额外环境）。
- **提交包（去依赖的代码副本 + 报告）**：`pnpm package:0601` 会在项目根生成 `0601/` 文件夹，内含全部源码（不含 `node_modules`、`.next`、`data`、日志与 `.env`）、依赖描述文件、一键启动脚本与上述报告 PDF，可直接打包提交。

## 文档

- [二期功能完成度审计](docs/phase2-completion-audit.md)
- [开发过程日志](docs/step-by-step-log.md)
- [AI 工具使用声明](docs/ai-tool-usage-statement.md)

## 隐私策略

- 不接入第三方统计 SDK。
- 用户目标、任务、搜索结果和运行日志只保存到本地数据库。
- DeepSeek API Key 只存在服务端环境变量，不进入浏览器 bundle。
- 启用搜索时，搜索关键词会通过本地 SearXNG 请求外部搜索引擎，建议先脱敏。
