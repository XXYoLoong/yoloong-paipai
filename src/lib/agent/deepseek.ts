import "server-only";

import { env } from "@/lib/env";
import {
  buildPlanMessages,
  REPAIR_PROMPT_SYSTEM,
  type DeepSeekMessage,
} from "@/lib/agent/prompts";
import { generatedPlanSchema } from "@/lib/schemas";
import type { EvidenceItem, GeneratedPlan, GoalInput } from "@/lib/types";

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
  memoryContext?: string,
): Promise<DeepSeekPlanResult> {
  if (!env.DEEPSEEK_API_KEY) {
    throw new Error("未配置 DEEPSEEK_API_KEY，已切换为本地基础拆解。");
  }

  const model = input.qualityMode === "quality" ? env.DEEPSEEK_HIGH_QUALITY_MODEL : env.DEEPSEEK_MODEL;
  const timeoutMs = input.qualityMode === "quality" ? 90_000 : 60_000;
  const messages = buildPlanMessages(input, evidenceItems, memoryContext);
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
  const raw = await callDeepSeek(
    model,
    [
      {
        role: "system",
        content: REPAIR_PROMPT_SYSTEM,
      },
      {
        role: "user",
        content: `以下 JSON 不符合 schema，请修复。错误：${errorMessage}\n\n${invalidContent}`,
      },
    ],
    timeoutMs,
  );

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

function parseModelJson(content: string) {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(withoutFence);
}
