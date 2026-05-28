import { detectSensitiveInput } from "@/lib/agent/heuristics";
import type { PlanWithTasks } from "@/lib/types";

export function scanPlanSensitive(plan: PlanWithTasks) {
  const flags: string[] = [];

  if (detectSensitiveInput(plan.originalGoal)) {
    flags.push("原始目标可能包含敏感信息");
  }

  for (const task of plan.tasks) {
    if (detectSensitiveInput(`${task.title} ${task.description}`)) {
      flags.push(`任务「${task.title}」描述可能包含敏感信息`);
    }
  }

  return flags;
}
