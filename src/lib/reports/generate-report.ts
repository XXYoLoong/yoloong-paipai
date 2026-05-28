import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PROMPT_VERSION } from "@/lib/agent/prompts";
import { PROMPT_V1_SNAPSHOT } from "@/lib/agent/prompts/v1-snapshot";
import { getLatestAgentRun, getPlan } from "@/lib/db/queries";
export async function generateProjectReport(planId: string) {
  const plan = getPlan(planId);
  if (!plan) {
    throw new Error("计划不存在");
  }

  const agentRun = getLatestAgentRun(planId);
  const doneTasks = plan.tasks.filter((t) => t.status === "done").length;
  const aiStatement = await loadAiStatement();

  const markdown = [
    `# ${plan.title} — 项目报告草稿`,
    "",
    `> 生成时间：${new Date().toLocaleString("zh-CN")}；Prompt 版本：${agentRun?.promptVersion ?? PROMPT_VERSION}`,
    "",
    "## 一、项目背景",
    "",
    `游龙排排面向「复杂目标 → 可执行任务」场景。当前样例目标：${plan.originalGoal}`,
    "",
    "## 二、技术选型",
    "",
    "- 前端：Next.js 16 + React 19 + TypeScript",
    "- 数据：SQLite + Drizzle ORM（本地优先）",
    "- Agent：DeepSeek JSON 输出 + Zod 校验 + 本地 fallback",
    "- 工具：SearXNG 本地搜索、来源可信度分级、记忆检索",
    "- 工程：访问密码、健康检查、提交包检查、Vitest",
    "",
    "## 三、实现细节",
    "",
    `- 目标类型：${plan.goalType}；主任务 ${plan.tasks.filter((t) => !t.parentTaskId).length} 个；子任务与依赖已支持`,
    `- Agent 最近运行：${agentRun?.modelName ?? "无"} / ${agentRun?.status ?? "无"}`,
    `- Prompt 演进：${PROMPT_V1_SNAPSHOT.version} → ${PROMPT_VERSION}`,
    "",
    "## 四、功能展示",
    "",
    `1. 模板化输入与 SSE 阶段反馈`,
    `2. 子任务树形看板与依赖时间轴`,
    `3. 导出中心：Markdown / DOCX / PDF / Excel / 素材包`,
    `4. 历史筛选、归档、复制与复盘面板`,
    "",
    "## 五、问题与解决",
    "",
    "- DeepSeek/SearXNG 不可用时自动降级，不中断主流程",
    "- 启动脚本与 SearXNG 配置问题已在过程记录中修复",
    "",
    "## 六、总结与展望",
    "",
    `当前计划完成率约 ${plan.tasks.length ? Math.round((doneTasks / plan.tasks.length) * 100) : 0}%。后续可扩展公网部署与演示视频。`,
    "",
    "## 七、AI 工具使用声明",
    "",
    aiStatement,
    "",
  ].join("\n");

  return { markdown, plan };
}

async function loadAiStatement() {
  try {
    return await readFile(join(process.cwd(), "docs", "ai-tool-usage-statement.md"), "utf8");
  } catch {
    return "本项目使用 AI 辅助开发，最终提交内容经人工审核。";
  }
}

export function appendAiStatement(markdown: string) {
  return `${markdown}\n\n---\n\n## AI 工具使用声明（附录）\n\n详见 docs/ai-tool-usage-statement.md`;
}
