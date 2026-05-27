import "server-only";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { stringifyJson } from "@/lib/db/json";
import { agentRuns, evidenceItems, plans, tasks } from "@/lib/db/schema";
import { goalInputSchema } from "@/lib/schemas";
import { searchMany } from "@/lib/search/searxng";
import type { AgentStage, EvidenceItem, GeneratedPlan, GoalInput, PlanTask } from "@/lib/types";
import {
  buildFallbackPlan,
  buildFollowUpQuestions,
  buildSearchQueries,
  detectSensitiveInput,
  inferGoalType,
} from "@/lib/agent/heuristics";
import { generatePlanWithDeepSeek } from "@/lib/agent/deepseek";
import { env } from "@/lib/env";

type StageLog = {
  stage: AgentStage;
  status: "done" | "skipped" | "failed";
  message: string;
};

export type GeneratePlanResult = {
  planId: string;
  plan: GeneratedPlan;
  evidenceItems: EvidenceItem[];
  stageLog: StageLog[];
  warnings: string[];
};

export async function generateAndPersistPlan(rawInput: unknown): Promise<GeneratePlanResult> {
  initDb();

  const input = normalizeGoalInput(goalInputSchema.parse(rawInput));
  const stageLog: StageLog[] = [];
  const warnings: string[] = [];
  const goalType = inferGoalType(input.goal);

  stageLog.push({
    stage: "intent_parser",
    status: "done",
    message: `识别目标类型：${goalType}`,
  });

  const followUpQuestions = buildFollowUpQuestions(input, goalType);
  stageLog.push({
    stage: "slot_extractor",
    status: "done",
    message: `已抽取时间、预算、地点、偏好等槽位，缺口 ${followUpQuestions.length} 个。`,
  });

  if (detectSensitiveInput(input.goal)) {
    warnings.push("检测到可能的手机号、身份证号、邮箱或地址信息，建议提交前先脱敏。");
  }

  stageLog.push({
    stage: "question_generator",
    status: followUpQuestions.length ? "done" : "skipped",
    message: followUpQuestions.length ? `生成 ${followUpQuestions.length} 个补充问题。` : "关键信息足够，未生成补充问题。",
  });

  const searchQueries = input.enableSearch ? buildSearchQueries(input, goalType) : [];
  stageLog.push({
    stage: "search_planner",
    status: searchQueries.length ? "done" : "skipped",
    message: searchQueries.length ? `生成 ${searchQueries.length} 个搜索查询。` : "用户关闭联网搜索。",
  });

  let foundEvidence: EvidenceItem[] = [];
  if (searchQueries.length) {
    try {
      const searchResult = await searchMany(searchQueries, 5);
      foundEvidence = searchResult.items;
      warnings.push(...searchResult.errors);
      stageLog.push({
        stage: "searxng_tool",
        status: foundEvidence.length ? "done" : "failed",
        message: foundEvidence.length
          ? `通过本地 SearXNG 获取 ${foundEvidence.length} 条来源。`
          : "未获取到搜索结果，将继续生成基础计划。",
      });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "SearXNG 搜索失败。");
      stageLog.push({
        stage: "searxng_tool",
        status: "failed",
        message: "SearXNG 搜索失败，将继续生成基础计划。",
      });
    }
  }

  let generatedPlan: GeneratedPlan;
  let modelName = env.DEEPSEEK_MODEL;
  let tokenUsage: Record<string, unknown> = {};
  let generationError: string | undefined;

  try {
    const result = await generatePlanWithDeepSeek(input, foundEvidence);
    generatedPlan = result.plan;
    tokenUsage = result.usage ?? {};
    stageLog.push({
      stage: "plan_generator",
      status: "done",
      message: result.repaired ? "DeepSeek 已生成计划，并经过一次 JSON 修复。" : "DeepSeek 已生成结构化计划。",
    });
  } catch (error) {
    generationError = error instanceof Error ? error.message : "DeepSeek 生成失败。";
    warnings.push(generationError);
    generatedPlan = buildFallbackPlan(
      {
        ...input,
        enableSearch: false,
      },
      foundEvidence.map((item) => item.id),
    );
    modelName = "local-fallback";
    stageLog.push({
      stage: "plan_generator",
      status: "failed",
      message: "已切换为本地基础任务拆解。",
    });
  }

  stageLog.push({
    stage: "validator",
    status: "done",
    message: "结构化结果已通过服务端 schema 校验。",
  });

  const planId = persistPlan(input, generatedPlan, foundEvidence);

  db.insert(agentRuns)
    .values({
      id: randomUUID(),
      planId,
      inputSummary: input.goal.slice(0, 160),
      modelName,
      tokenUsageJson: JSON.stringify(tokenUsage),
      status: generationError ? "fallback" : "success",
      errorMessage: generationError,
      stageLogJson: JSON.stringify(stageLog),
    })
    .run();

  stageLog.push({
    stage: "persistence",
    status: "done",
    message: "计划、任务、来源证据和运行日志已保存。",
  });

  return {
    planId,
    plan: generatedPlan,
    evidenceItems: foundEvidence,
    stageLog,
    warnings,
  };
}

function normalizeGoalInput(input: ReturnType<typeof goalInputSchema.parse>): GoalInput {
  return {
    goal: input.goal,
    deadline: input.deadline || undefined,
    budget: typeof input.budget === "number" ? input.budget : undefined,
    location: input.location || undefined,
    preferences: input.preferences,
    constraints: input.constraints,
    enableSearch: input.enableSearch,
    qualityMode: input.qualityMode,
  };
}

function persistPlan(input: GoalInput, plan: GeneratedPlan, foundEvidence: EvidenceItem[]) {
  const planId = randomUUID();

  db.transaction(() => {
    db.insert(plans)
      .values({
        id: planId,
        title: plan.title,
        originalGoal: input.goal,
        goalType: plan.goalType,
        status: "active",
        summary: plan.summary,
        assumptionsJson: stringifyJson(plan.assumptions),
        followUpQuestionsJson: stringifyJson(plan.followUpQuestions),
        searchQueriesJson: stringifyJson(plan.searchQueries),
      })
      .run();

    for (const item of foundEvidence) {
      db.insert(evidenceItems)
        .values({
          ...item,
          planId,
        })
        .onConflictDoNothing()
        .run();
    }

    insertTasks(plan.tasks, planId, undefined);
  });

  return planId;
}

function insertTasks(planTasks: PlanTask[], planId: string, parentTaskId: string | undefined) {
  planTasks.forEach((task, index) => {
    const taskId = randomUUID();
    db.insert(tasks)
      .values({
        id: taskId,
        planId,
        parentTaskId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        estimatedMinutes: task.estimatedMinutes,
        evidenceIdsJson: stringifyJson(task.evidenceIds ?? []),
        sortOrder: index,
      })
      .run();

    if (task.subtasks?.length) {
      insertTasks(task.subtasks, planId, taskId);
    }
  });
}

export function deletePlan(planId: string) {
  initDb();
  db.delete(plans).where(eq(plans.id, planId)).run();
}
