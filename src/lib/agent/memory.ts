import "server-only";

/**
 * Agent 记忆中心。按「目标类型」维度沉淀用户的偏好与约束：
 * - retrieveMemoryContext：生成前检索同类目标的历史偏好，拼成上下文注入 Prompt；
 * - upsertMemoryFromPlan：生成后从本次输入回写记忆，让同类目标越用越贴合。
 * 仅保留最近 MAX_MEMORY_ITEMS 条，避免上下文无限膨胀。记忆只存本地库，可在设置页清空。
 */

import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { parseJsonArray, stringifyJson } from "@/lib/db/json";
import { userMemory } from "@/lib/db/schema";
import type { GoalInput, GoalType, PlanWithTasks } from "@/lib/types";

const MAX_MEMORY_ITEMS = 5;

export function retrieveMemoryContext(goalType: GoalType, goal: string): string | undefined {
  initDb();

  const rows = db
    .select()
    .from(userMemory)
    .where(eq(userMemory.goalType, goalType))
    .orderBy(desc(userMemory.updatedAt))
    .limit(MAX_MEMORY_ITEMS)
    .all();

  if (!rows.length) {
    return undefined;
  }

  const snippets = rows.map((row, index) => {
    const prefs = parseJsonArray<string>(row.preferencesJson);
    const constraints = parseJsonArray<string>(row.constraintsJson);
    return `${index + 1}. 偏好：${prefs.join("、") || "无"}；限制：${constraints.join("、") || "无"}；备注：${row.notes}`;
  });

  return `目标类型「${goalType}」的历史记忆（与当前目标「${goal.slice(0, 40)}…」相关）：\n${snippets.join("\n")}`;
}

export function upsertMemoryFromPlan(plan: PlanWithTasks, input: GoalInput) {
  initDb();

  const preferences = input.preferences ?? [];
  const constraints = input.constraints ?? [];
  if (!preferences.length && !constraints.length) {
    return;
  }

  const notes = `最近计划：${plan.title}；完成率参考可在复盘中更新。`;

  db.insert(userMemory)
    .values({
      id: randomUUID(),
      goalType: plan.goalType,
      preferencesJson: stringifyJson(preferences),
      constraintsJson: stringifyJson(constraints),
      notes,
    })
    .run();
}
