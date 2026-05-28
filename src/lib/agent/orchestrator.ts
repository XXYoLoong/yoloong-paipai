import "server-only";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { stringifyJson } from "@/lib/db/json";
import { getPlan } from "@/lib/db/queries";
import { agentRuns, evidenceItems, plans, tasks } from "@/lib/db/schema";
import { goalInputSchema } from "@/lib/schemas";
import { searchMany } from "@/lib/search/searxng";
import type { EvidenceItem, GeneratedPlan, GoalInput, PlanTask, StageLogEntry } from "@/lib/types";
import {
  buildFallbackPlan,
  buildFollowUpQuestions,
  buildSearchQueries,
  detectSensitiveInput,
  inferGoalType,
} from "@/lib/agent/heuristics";
import { generatePlanWithDeepSeek } from "@/lib/agent/deepseek";
import { normalizePlanSchedule, remapDependencyIds } from "@/lib/agent/due-dates";
import { retrieveMemoryContext, upsertMemoryFromPlan } from "@/lib/agent/memory";
import { PROMPT_VERSION, SCHEMA_VERSION } from "@/lib/agent/prompts";
import { fillTemplateGoal, getTemplate } from "@/lib/templates/builtin";
import { env } from "@/lib/env";

export type GeneratePlanResult = {
  planId: string;
  plan: GeneratedPlan;
  evidenceItems: EvidenceItem[];
  stageLog: StageLogEntry[];
  warnings: string[];
};

export type PipelineCallbacks = {
  onStage?: (entry: StageLogEntry) => void;
  onWarning?: (message: string) => void;
};

export async function generateAndPersistPlan(rawInput: unknown): Promise<GeneratePlanResult> {
  return runPlanPipeline(rawInput);
}

export async function runPlanPipeline(rawInput: unknown, callbacks: PipelineCallbacks = {}): Promise<GeneratePlanResult> {
  initDb();
  const startedAt = Date.now();

  const input = await resolveGoalInput(goalInputSchema.parse(rawInput));
  const stageLog: StageLogEntry[] = [];
  const warnings: string[] = [];

  const pushStage = (entry: StageLogEntry) => {
    stageLog.push(entry);
    callbacks.onStage?.(entry);
  };

  const pushWarning = (message: string) => {
    warnings.push(message);
    callbacks.onWarning?.(message);
  };

  const goalType = inferGoalType(input.goal);

  pushStage({
    stage: "intent_parser",
    status: "done",
    message: `识别目标类型：${goalType}`,
  });

  const followUpQuestions = buildFollowUpQuestions(input, goalType);
  pushStage({
    stage: "slot_extractor",
    status: "done",
    message: `已抽取时间、预算、地点、偏好等槽位，缺口 ${followUpQuestions.length} 个。`,
  });

  if (detectSensitiveInput(input.goal)) {
    pushWarning("检测到可能的手机号、身份证号、邮箱或地址信息，建议提交前先脱敏。");
  }

  pushStage({
    stage: "question_generator",
    status: followUpQuestions.length ? "done" : "skipped",
    message: followUpQuestions.length ? `生成 ${followUpQuestions.length} 个补充问题。` : "关键信息足够，未生成补充问题。",
  });

  const memoryContext =
    input.memoryMode !== "off" ? retrieveMemoryContext(goalType, input.goal) : undefined;

  if (memoryContext) {
    pushWarning("已注入历史记忆上下文，同类目标将参考以往偏好。");
  }

  const searchQueries = input.enableSearch ? buildSearchQueries(input, goalType) : [];
  pushStage({
    stage: "search_planner",
    status: searchQueries.length ? "done" : "skipped",
    message: searchQueries.length ? `生成 ${searchQueries.length} 个搜索查询。` : "用户关闭联网搜索。",
  });

  let foundEvidence: EvidenceItem[] = [];
  if (searchQueries.length) {
    try {
      const searchResult = await searchMany(searchQueries, 5);
      foundEvidence = searchResult.items;
      for (const err of searchResult.errors) {
        pushWarning(err);
      }
      pushStage({
        stage: "searxng_tool",
        status: foundEvidence.length ? "done" : "failed",
        message: foundEvidence.length
          ? `通过本地 SearXNG 获取 ${foundEvidence.length} 条来源（含可信度分级）。`
          : "未获取到搜索结果，将继续生成基础计划。",
      });
    } catch (error) {
      pushWarning(error instanceof Error ? error.message : "SearXNG 搜索失败。");
      pushStage({
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
  let fallbackReason: string | undefined;

  try {
    const result = await generatePlanWithDeepSeek(input, foundEvidence, memoryContext);
    generatedPlan = result.plan;
    tokenUsage = result.usage ?? {};
    if (memoryContext && !generatedPlan.summary.includes("记忆")) {
      generatedPlan.summary = `${generatedPlan.summary}（已参考历史记忆偏好）`;
    }
    pushStage({
      stage: "plan_generator",
      status: "done",
      message: result.repaired ? "DeepSeek 已生成计划，并经过一次 JSON 修复。" : "DeepSeek 已生成结构化计划。",
    });
  } catch (error) {
    generationError = error instanceof Error ? error.message : "DeepSeek 生成失败。";
    fallbackReason = generationError;
    pushWarning(generationError);
    generatedPlan = buildFallbackPlan(
      {
        ...input,
        enableSearch: false,
      },
      foundEvidence.map((item) => item.id),
    );
    modelName = "local-fallback";
    pushStage({
      stage: "plan_generator",
      status: "failed",
      message: "已切换为本地基础任务拆解。",
    });
  }

  pushStage({
    stage: "validator",
    status: "done",
    message: "结构化结果已通过服务端 schema 校验。",
  });

  generatedPlan = normalizePlanSchedule(generatedPlan, { deadline: input.deadline });

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
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      fallbackReason,
      latencyMs: Date.now() - startedAt,
    })
    .run();

  pushStage({
    stage: "persistence",
    status: "done",
    message: "计划、任务、来源证据和运行日志已保存。",
  });

  const stored = getPlan(planId);
  if (stored) {
    upsertMemoryFromPlan(stored, input);
  }

  return {
    planId,
    plan: generatedPlan,
    evidenceItems: foundEvidence,
    stageLog,
    warnings,
  };
}

async function resolveGoalInput(parsed: ReturnType<typeof goalInputSchema.parse>): Promise<GoalInput> {
  const base = normalizeGoalInput(parsed);

  if (!parsed.templateId) {
    return base;
  }

  const template = getTemplate(parsed.templateId);
  if (!template) {
    return base;
  }

  const mergedGoal = base.goal.length >= 8 ? base.goal : fillTemplateGoal(template);

  return {
    ...base,
    goal: mergedGoal,
    deadline: base.deadline ?? template.defaultFields.deadline,
    budget: base.budget ?? (template.defaultFields.budget ? Number(template.defaultFields.budget) : undefined),
    location: base.location ?? template.defaultFields.location,
    preferences:
      base.preferences?.length ? base.preferences : template.defaultFields.preferencesText?.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    constraints:
      base.constraints?.length ? base.constraints : template.defaultFields.constraintsText?.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    enableSearch: base.enableSearch ?? template.defaultFields.enableSearch ?? true,
    qualityMode: base.qualityMode ?? template.defaultFields.qualityMode ?? "fast",
    templateId: template.id,
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
    templateId: input.templateId,
    memoryMode: input.memoryMode,
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
        templateId: input.templateId,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
      })
      .run();

    for (const item of foundEvidence) {
      db.insert(evidenceItems)
        .values({
          id: item.id,
          planId,
          title: item.title,
          snippet: item.snippet,
          url: item.url,
          source: item.source,
          queryHash: item.queryHash,
          query: item.query,
          credibility: item.credibility ?? "unverified",
          domain: item.domain,
          citationReason: item.citationReason,
        })
        .onConflictDoNothing()
        .run();
    }

    insertTasks(plan.tasks, planId);
  });

  return planId;
}

type PendingTask = {
  task: PlanTask;
  tempKey: string;
  parentTempKey?: string;
  sortOrder: number;
};

function flattenPlanTasks(planTasks: PlanTask[], parentTempKey?: string, bucket: PendingTask[] = []) {
  planTasks.forEach((task, index) => {
    const tempKey = task.id?.trim() || `${parentTempKey ?? "root"}:${index}`;
    bucket.push({
      task,
      tempKey,
      parentTempKey,
      sortOrder: index,
    });
    if (task.subtasks?.length) {
      flattenPlanTasks(task.subtasks, tempKey, bucket);
    }
  });
  return bucket;
}

function insertTasks(planTasks: PlanTask[], planId: string) {
  const pending = flattenPlanTasks(planTasks);
  const idMap = new Map<string, string>();

  for (const item of pending) {
    const taskId = randomUUID();
    idMap.set(item.tempKey, taskId);
    if (item.task.id?.trim()) {
      idMap.set(item.task.id.trim(), taskId);
    }
  }

  const validIds = new Set(idMap.values());

  for (const item of pending) {
    const taskId = idMap.get(item.tempKey)!;
    const parentTaskId = item.parentTempKey ? idMap.get(item.parentTempKey) : undefined;
    const dependencyIds = remapDependencyIds(item.task.dependencyIds, idMap, validIds);

    db.insert(tasks)
      .values({
        id: taskId,
        planId,
        parentTaskId,
        title: item.task.title,
        description: item.task.description,
        priority: item.task.priority,
        status: item.task.status,
        dueDate: item.task.dueDate,
        estimatedMinutes: item.task.estimatedMinutes,
        evidenceIdsJson: stringifyJson(item.task.evidenceIds ?? []),
        dependencyIdsJson: stringifyJson(dependencyIds),
        sortOrder: item.sortOrder,
      })
      .run();
  }
}

export function deletePlan(planId: string) {
  initDb();
  db.delete(plans).where(eq(plans.id, planId)).run();
}
