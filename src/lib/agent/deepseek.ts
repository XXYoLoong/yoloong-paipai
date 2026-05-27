import "server-only";

import { env } from "@/lib/env";
import { generatedPlanSchema } from "@/lib/schemas";
import type { EvidenceItem, GeneratedPlan, GoalInput } from "@/lib/types";

type DeepSeekMessage = {
  role: "system" | "user";
  content: string;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: Record<string, unknown>;
};

export type DeepSeekPlanResult = {
  plan: GeneratedPlan;
  usage?: Record<string, unknown>;
  repaired: boolean;
};

export async function generatePlanWithDeepSeek(
  input: GoalInput,
  evidenceItems: EvidenceItem[],
): Promise<DeepSeekPlanResult> {
  if (!env.DEEPSEEK_API_KEY) {
    throw new Error("未配置 DEEPSEEK_API_KEY，已切换为本地基础拆解。");
  }

  const model = input.qualityMode === "quality" ? env.DEEPSEEK_HIGH_QUALITY_MODEL : env.DEEPSEEK_MODEL;
  const timeoutMs = input.qualityMode === "quality" ? 90_000 : 60_000;
  const messages = buildMessages(input, evidenceItems);
  const raw = await callDeepSeek(model, messages, timeoutMs);
  const content = raw.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("DeepSeek 未返回内容。");
  }

  const firstParse = parseModelJson(content);
  const firstResult = generatedPlanSchema.safeParse(firstParse);

  if (firstResult.success) {
    return {
      plan: firstResult.data,
      usage: raw.usage,
      repaired: false,
    };
  }

  const repaired = await repairPlanJson(model, content, firstResult.error.message, timeoutMs);
  return {
    plan: repaired,
    usage: raw.usage,
    repaired: true,
  };
}

async function repairPlanJson(model: string, invalidContent: string, errorMessage: string, timeoutMs: number) {
  const raw = await callDeepSeek(model, [
    {
      role: "system",
      content:
        "你是 JSON 修复器。只输出符合要求的 JSON，不要 Markdown，不要解释。必须包含 title、goalType、summary、assumptions、followUpQuestions、searchQueries、tasks。",
    },
    {
      role: "user",
      content: `以下 JSON 不符合 schema，请修复。错误：${errorMessage}\n\n${invalidContent}`,
    },
  ], timeoutMs);

  const content = raw.choices?.[0]?.message?.content;
  const parsed = generatedPlanSchema.parse(parseModelJson(content ?? "{}"));
  return parsed;
}

async function callDeepSeek(model: string, messages: DeepSeekMessage[], timeoutMs: number) {
  let response: Response;
  try {
    response = await fetch(`${env.DEEPSEEK_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 3000,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(formatDeepSeekFetchError(error, timeoutMs));
  }

  if (!response.ok) {
    throw new Error(`DeepSeek 请求失败：HTTP ${response.status}`);
  }

  return (await response.json()) as DeepSeekResponse;
}

function formatDeepSeekFetchError(error: unknown, timeoutMs: number) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return `DeepSeek 生成超时（已等待 ${Math.round(timeoutMs / 1000)} 秒），已切换为本地基础拆解。`;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("fetch failed")) {
      return "DeepSeek 网络请求失败，请检查网络、代理或 DEEPSEEK_BASE_URL；本次已切换为本地基础拆解。";
    }
    if (message.includes("aborted") || message.includes("timeout")) {
      return `DeepSeek 请求被超时中断（已等待 ${Math.round(timeoutMs / 1000)} 秒），已切换为本地基础拆解。`;
    }
    return `DeepSeek 请求失败：${error.message}`;
  }

  return "DeepSeek 请求失败，已切换为本地基础拆解。";
}

function buildMessages(input: GoalInput, evidenceItems: EvidenceItem[]): DeepSeekMessage[] {
  const evidenceText = evidenceItems
    .slice(0, 12)
    .map((item, index) => `${index + 1}. [${item.id}] ${item.title}\n${item.snippet}\n${item.url}`)
    .join("\n\n");

  return [
    {
      role: "system",
      content: [
        "你是《游龙排排》的智能任务规划 Agent。",
        "你的任务是把用户复杂目标拆成可以执行的 To-do List。",
        "只输出 JSON 对象，不要 Markdown。",
        "JSON 字段必须为：title, goalType, summary, assumptions, followUpQuestions, searchQueries, tasks。",
        "goalType 只能是 travel, study, event, career, shopping, health, general。",
        "tasks 至少 5 个主任务，任务字段为 title, description, priority, status, dueDate, estimatedMinutes, evidenceIds, subtasks。",
        "priority 只能是 high、medium、low；status 默认 todo。",
        "如果引用搜索证据，只能使用给出的 evidence id。",
        "不要编造实时价格、开放时间、政策或数据；没有证据时写成待确认任务。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          input,
          evidenceItems: evidenceText || "未提供搜索证据。",
        },
        null,
        2,
      ),
    },
  ];
}

function parseModelJson(content: string) {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(withoutFence);
}
