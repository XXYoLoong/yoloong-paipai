# 游龙排排

基于 `Next.js App Router + React 19 + TypeScript` 的智能任务规划器。用户输入复杂目标后，系统会通过轻量 Agent 状态机拆解任务，按需调用本地 SearXNG 查询公开信息，再生成可编辑、可拖拽、可导出的 To-do List。

## 技术栈

- Web：Next.js 16、React 19、TypeScript、Tailwind CSS v4
- Agent：DeepSeek Chat Completion API、JSON output、Zod 结构化校验
- 搜索：本地 SearXNG JSON API
- 数据：SQLite、Drizzle ORM、better-sqlite3
- 交互：React Hook Form、@dnd-kit、lucide-react

## 本地开发

Windows 一键启动：

```bat
start-youlong-paipai.bat
```

脚本会读取当前系统环境变量中的 `DEEPSEEK_API_KEY`，不会把密钥写入项目文件；如果检测到 Docker，会自动启动本地 SearXNG。

密钥读取顺序：

1. 当前终端进程环境变量。
2. Windows 用户环境变量。
3. Windows 系统环境变量。
4. 三层都没有时，脚本会停止并提示手动执行 `setx DEEPSEEK_API_KEY "你的 DeepSeek Key"`。

```bash
pnpm install
cp .env.example .env
pnpm dev
```

没有 `DEEPSEEK_API_KEY` 时，应用会自动使用本地基础拆解，方便课堂演示。若要启用联网搜索，请先启动 SearXNG，并确保 `settings.yml` 中启用了 `search.formats: [html, json]`。

```bash
docker compose up searxng
```

开发地址：

- Web：http://localhost:3000
- SearXNG：http://localhost:8080

## Docker 部署

```bash
cp .env.example .env
docker compose up --build
```

默认数据保存在 Docker volume `youlong-data` 中，SQLite 路径为 `/data/youlong.sqlite`。

## 核心功能

- 复杂目标输入：目标、截止时间、预算、地点、偏好、限制条件
- Agent 拆解：意图识别、槽位提取、补充问题、搜索规划、计划生成、校验保存
- 本地搜索：通过 SearXNG 获取来源并绑定到任务
- 任务管理：待办、进行中、已完成，支持拖拽排序、手动新增、编辑
- 历史计划：所有计划保存到本地 SQLite
- Markdown 导出：`/api/export/:planId.md`

## 隐私策略

- 不接入第三方统计 SDK。
- 用户目标、任务、搜索结果和运行日志只保存到本地数据库。
- DeepSeek API Key 只存在服务端环境变量，不进入浏览器 bundle。
- 启用搜索时，搜索关键词会通过本地 SearXNG 请求外部搜索引擎，建议先脱敏。
