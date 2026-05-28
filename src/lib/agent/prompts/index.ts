import type { EvidenceItem, GoalInput } from "@/lib/types";

export const PROMPT_VERSION = "v2.0.0";
export const SCHEMA_VERSION = "v2.0.0";

export type DeepSeekMessage = {
  role: "system" | "user";
  content: string;
};

export function buildPlanMessages(
  input: GoalInput,
  evidenceItems: EvidenceItem[],
  memoryContext?: string,
): DeepSeekMessage[] {
  const evidenceText = evidenceItems
    .slice(0, 12)
    .map(
      (item, index) =>
        `${index + 1}. [${item.id}] (${item.credibility ?? "unverified"}) ${item.title}\n${item.snippet}\n${item.url}\n引用说明：${item.citationReason ?? "待确认"}`,
    )
    .join("\n\n");

  const systemParts = [
    "你是《游龙排排》的智能任务规划 Agent。",
    "你的任务是把用户复杂目标拆成可以执行的 To-do List。",
    "只输出 JSON 对象，不要 Markdown。",
    "JSON 字段必须为：title, goalType, summary, assumptions, followUpQuestions, searchQueries, tasks。",
    "goalType 只能是 travel, study, event, career, shopping, health, general。",
    "tasks 至少 5 个主任务，任务字段为 title, description, priority, status, dueDate, estimatedMinutes, evidenceIds, dependencyIds, subtasks。",
    "dependencyIds 为同计划内其它任务 id 的字符串数组，可为空。",
    "priority 只能是 high、medium、low；status 默认 todo。",
    "如果引用搜索证据，只能使用给出的 evidence id。",
    "不要编造实时价格、开放时间、政策或数据；没有证据时写成待确认任务。",
  ];

  if (input.deadline?.trim()) {
    systemParts.push(
      `用户已提供目标截止时间 ${input.deadline.trim()}。每个主任务必须包含 dueDate（YYYY-MM-DD），按执行顺序从今天起递增，且不得早于今天、不得晚于该日期。`,
    );
  } else {
    systemParts.push("若未提供目标 deadline，dueDate 可留空字符串。");
  }

  if (memoryContext) {
    systemParts.push(`用户历史记忆（生成时请参考并在 summary 末尾简要说明依据）：\n${memoryContext}`);
  }

  return [
    {
      role: "system",
      content: systemParts.join("\n"),
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

export const REPAIR_PROMPT_SYSTEM =
  "你是 JSON 修复器。只输出符合要求的 JSON，不要 Markdown，不要解释。必须包含 title、goalType、summary、assumptions、followUpQuestions、searchQueries、tasks。";
