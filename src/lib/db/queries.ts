import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { parseJsonArray, stringifyJson } from "@/lib/db/json";
import {
  agentRuns,
  evidenceItems,
  planReviews,
  plans,
  settings,
  tasks,
} from "@/lib/db/schema";
import type {
  AgentRunSummary,
  EvidenceItem,
  GoalType,
  PlanReview,
  PlanWithTasks,
  StoredTask,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";

export type ListPlansQuery = {
  q?: string;
  goalType?: string;
  status?: string;
  from?: string;
  to?: string;
  includeArchived?: boolean;
};

export function listPlans(query: ListPlansQuery = {}) {
  initDb();

  const conditions = [];

  if (!query.includeArchived) {
    conditions.push(or(eq(plans.status, "active"), eq(plans.status, "draft")));
  }

  if (query.status) {
    conditions.push(eq(plans.status, query.status));
  }

  if (query.goalType) {
    conditions.push(eq(plans.goalType, query.goalType));
  }

  if (query.q) {
    const pattern = `%${query.q}%`;
    conditions.push(or(like(plans.title, pattern), like(plans.originalGoal, pattern), like(plans.summary, pattern)));
  }

  if (query.from) {
    conditions.push(gte(plans.createdAt, query.from));
  }

  if (query.to) {
    conditions.push(lte(plans.createdAt, query.to));
  }

  const rows = db
    .select()
    .from(plans)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(plans.createdAt))
    .all();

  return rows.map((plan) => ({
    id: plan.id,
    title: plan.title,
    originalGoal: plan.originalGoal,
    goalType: plan.goalType as GoalType,
    status: plan.status,
    summary: plan.summary,
    templateId: plan.templateId ?? undefined,
    archivedAt: plan.archivedAt ?? undefined,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  }));
}

export function getPlan(planId: string): PlanWithTasks | null {
  initDb();

  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  if (!plan) {
    return null;
  }

  const taskRows = db
    .select()
    .from(tasks)
    .where(eq(tasks.planId, planId))
    .orderBy(asc(tasks.parentTaskId), asc(tasks.sortOrder))
    .all();

  const evidenceRows = db.select().from(evidenceItems).where(eq(evidenceItems.planId, planId)).all();

  return {
    id: plan.id,
    title: plan.title,
    originalGoal: plan.originalGoal,
    goalType: plan.goalType as GoalType,
    status: plan.status as "draft" | "active" | "archived",
    summary: plan.summary,
    assumptions: parseJsonArray<string>(plan.assumptionsJson),
    followUpQuestions: parseJsonArray<string>(plan.followUpQuestionsJson),
    searchQueries: parseJsonArray<string>(plan.searchQueriesJson),
    templateId: plan.templateId ?? undefined,
    promptVersion: plan.promptVersion ?? undefined,
    schemaVersion: plan.schemaVersion ?? undefined,
    archivedAt: plan.archivedAt ?? undefined,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    tasks: taskRows.map(mapTaskRow),
    evidenceItems: evidenceRows.map(mapEvidenceRow),
  };
}

export function updateTask(
  taskId: string,
  patch: Partial<{
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate: string | null;
    estimatedMinutes: number | null;
    dependencyIds: string[];
    riskLevel: string | null;
    confirmRequired: boolean;
    completedAt: string | null;
  }>,
) {
  initDb();

  const set: Record<string, unknown> = {
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };

  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.status !== undefined) {
    set.status = patch.status;
    if (patch.status === "done" && patch.completedAt === undefined) {
      set.completedAt = new Date().toISOString();
    }
    if (patch.status !== "done" && patch.completedAt === undefined) {
      set.completedAt = null;
    }
  }
  if (patch.dueDate !== undefined) set.dueDate = patch.dueDate;
  if (patch.estimatedMinutes !== undefined) set.estimatedMinutes = patch.estimatedMinutes;
  if (patch.dependencyIds !== undefined) set.dependencyIdsJson = stringifyJson(patch.dependencyIds);
  if (patch.riskLevel !== undefined) set.riskLevel = patch.riskLevel;
  if (patch.confirmRequired !== undefined) set.confirmRequired = patch.confirmRequired ? 1 : 0;
  if (patch.completedAt !== undefined) set.completedAt = patch.completedAt;

  db.update(tasks).set(set).where(eq(tasks.id, taskId)).run();

  const updated = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
  return updated ? mapTaskRow(updated) : null;
}

export function reorderTasks(items: Array<{ id: string; sortOrder: number }>) {
  initDb();

  db.transaction(() => {
    for (const item of items) {
      db.update(tasks)
        .set({
          sortOrder: item.sortOrder,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(tasks.id, item.id))
        .run();
    }
  });
}

export function deleteTasks(taskIds: string[]) {
  initDb();

  if (!taskIds.length) {
    return;
  }

  db.delete(tasks).where(inArray(tasks.id, taskIds)).run();
}

export function getSetting(key: string) {
  initDb();
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

export function setSetting(key: string, value: string) {
  initDb();
  db.insert(settings)
    .values({
      key,
      value,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    })
    .run();
}

export function getAppSettings() {
  return {
    defaultEnableSearch: getSetting("default_enable_search") ?? "true",
    defaultQualityMode: getSetting("default_quality_mode") ?? "fast",
  };
}

export function saveAppSettings(input: { defaultEnableSearch?: boolean; defaultQualityMode?: "fast" | "quality" }) {
  if (input.defaultEnableSearch !== undefined) {
    setSetting("default_enable_search", String(input.defaultEnableSearch));
  }
  if (input.defaultQualityMode !== undefined) {
    setSetting("default_quality_mode", input.defaultQualityMode);
  }
  return getAppSettings();
}

export function clearAllPlanData() {
  initDb();
  db.run(sql`DELETE FROM export_jobs`);
  db.run(sql`DELETE FROM plan_reviews`);
  db.run(sql`DELETE FROM agent_runs`);
  db.run(sql`DELETE FROM evidence_items`);
  db.run(sql`DELETE FROM tasks`);
  db.run(sql`DELETE FROM plans`);
  db.run(sql`DELETE FROM search_cache`);
}

export function archivePlan(planId: string, archived: boolean) {
  initDb();
  db.update(plans)
    .set({
      status: archived ? "archived" : "active",
      archivedAt: archived ? new Date().toISOString() : null,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(plans.id, planId))
    .run();
  return getPlan(planId);
}

export function clonePlan(planId: string) {
  initDb();
  const source = getPlan(planId);
  if (!source) {
    return null;
  }

  const newPlanId = randomUUID();
  const taskIdMap = new Map<string, string>();

  db.transaction(() => {
    db.insert(plans)
      .values({
        id: newPlanId,
        title: `${source.title}（副本）`,
        originalGoal: source.originalGoal,
        goalType: source.goalType,
        status: "active",
        summary: source.summary,
        assumptionsJson: stringifyJson(source.assumptions),
        followUpQuestionsJson: stringifyJson(source.followUpQuestions),
        searchQueriesJson: stringifyJson(source.searchQueries),
        templateId: source.templateId,
      })
      .run();

    for (const task of source.tasks) {
      taskIdMap.set(task.id, randomUUID());
    }

    for (const task of source.tasks) {
      const newId = taskIdMap.get(task.id)!;
      const newParentId = task.parentTaskId ? taskIdMap.get(task.parentTaskId) : undefined;
      const dependencyIds = (task.dependencyIds ?? []).map((id) => taskIdMap.get(id) ?? id);

      db.insert(tasks)
        .values({
          id: newId,
          planId: newPlanId,
          parentTaskId: newParentId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: "todo",
          dueDate: task.dueDate,
          estimatedMinutes: task.estimatedMinutes,
          evidenceIdsJson: stringifyJson(task.evidenceIds ?? []),
          dependencyIdsJson: stringifyJson(dependencyIds),
          sortOrder: task.sortOrder,
        })
        .run();
    }

    for (const item of source.evidenceItems) {
      db.insert(evidenceItems)
        .values({
          ...item,
          id: randomUUID(),
          planId: newPlanId,
        })
        .run();
    }
  });

  return getPlan(newPlanId);
}

export function getLatestAgentRun(planId: string): AgentRunSummary | null {
  initDb();
  const row = db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.planId, planId))
    .orderBy(desc(agentRuns.createdAt))
    .get();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    planId: row.planId,
    modelName: row.modelName,
    status: row.status,
    promptVersion: row.promptVersion ?? undefined,
    schemaVersion: row.schemaVersion ?? undefined,
    stageLog: JSON.parse(row.stageLogJson) as AgentRunSummary["stageLog"],
    createdAt: row.createdAt,
  };
}

export function listPlanReviews(planId: string): PlanReview[] {
  initDb();
  return db
    .select()
    .from(planReviews)
    .where(eq(planReviews.planId, planId))
    .orderBy(desc(planReviews.createdAt))
    .all()
    .map((row) => ({
      id: row.id,
      planId: row.planId,
      completionRate: row.completionRate,
      delayReasons: parseJsonArray<string>(row.delayReasonsJson),
      summary: row.summary,
      createdAt: row.createdAt,
    }));
}

export function createPlanReview(input: {
  planId: string;
  completionRate: number;
  delayReasons: string[];
  summary: string;
}) {
  initDb();
  const id = randomUUID();
  db.insert(planReviews)
    .values({
      id,
      planId: input.planId,
      completionRate: input.completionRate,
      delayReasonsJson: stringifyJson(input.delayReasons),
      summary: input.summary,
    })
    .run();
  return listPlanReviews(input.planId).find((review) => review.id === id)!;
}

export function computeCompletionRate(planId: string) {
  const plan = getPlan(planId);
  if (!plan || !plan.tasks.length) {
    return 0;
  }
  const done = plan.tasks.filter((task) => task.status === "done").length;
  return Math.round((done / plan.tasks.length) * 100) / 100;
}

function mapTaskRow(task: typeof tasks.$inferSelect): StoredTask {
  return {
    id: task.id,
    planId: task.planId,
    parentTaskId: task.parentTaskId ?? undefined,
    title: task.title,
    description: task.description,
    priority: task.priority as TaskPriority,
    status: task.status as TaskStatus,
    dueDate: task.dueDate ?? undefined,
    estimatedMinutes: task.estimatedMinutes ?? undefined,
    evidenceIds: parseJsonArray<string>(task.evidenceIdsJson),
    dependencyIds: parseJsonArray<string>(task.dependencyIdsJson),
    riskLevel: task.riskLevel ?? undefined,
    confirmRequired: task.confirmRequired === 1,
    completedAt: task.completedAt ?? undefined,
    subtasks: [],
    sortOrder: task.sortOrder,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function mapEvidenceRow(item: typeof evidenceItems.$inferSelect): EvidenceItem {
  return {
    id: item.id,
    title: item.title,
    snippet: item.snippet,
    url: item.url,
    source: item.source,
    queryHash: item.queryHash,
    query: item.query,
    credibility: (item.credibility as EvidenceItem["credibility"]) ?? "unverified",
    domain: item.domain ?? undefined,
    citationReason: item.citationReason ?? undefined,
  };
}

export function createManualTask(input: {
  planId: string;
  parentTaskId?: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate?: string;
}) {
  initDb();

  const id = randomUUID();
  const maxOrder =
    db
      .select({ value: sql<number>`COALESCE(MAX(${tasks.sortOrder}), -1)` })
      .from(tasks)
      .where(eq(tasks.planId, input.planId))
      .get()?.value ?? -1;

  db.insert(tasks)
    .values({
      id,
      planId: input.planId,
      parentTaskId: input.parentTaskId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: "todo",
      dueDate: input.dueDate,
      evidenceIdsJson: stringifyJson([]),
      dependencyIdsJson: stringifyJson([]),
      sortOrder: maxOrder + 1,
    })
    .run();

  return getPlan(input.planId);
}
