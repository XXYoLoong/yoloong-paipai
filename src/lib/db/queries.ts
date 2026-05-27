import "server-only";

import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { parseJsonArray, stringifyJson } from "@/lib/db/json";
import { evidenceItems, plans, settings, tasks } from "@/lib/db/schema";
import type { EvidenceItem, GoalType, PlanWithTasks, StoredTask, TaskPriority, TaskStatus } from "@/lib/types";

export function listPlans() {
  initDb();

  return db.select().from(plans).orderBy(desc(plans.createdAt)).all().map((plan) => ({
    id: plan.id,
    title: plan.title,
    originalGoal: plan.originalGoal,
    goalType: plan.goalType as GoalType,
    status: plan.status,
    summary: plan.summary,
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
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    tasks: taskRows.map(mapTaskRow),
    evidenceItems: evidenceRows.map(
      (item): EvidenceItem => ({
        id: item.id,
        title: item.title,
        snippet: item.snippet,
        url: item.url,
        source: item.source,
        queryHash: item.queryHash,
        query: item.query,
      }),
    ),
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
  }>,
) {
  initDb();

  const set: Record<string, unknown> = {
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };

  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.dueDate !== undefined) set.dueDate = patch.dueDate;
  if (patch.estimatedMinutes !== undefined) set.estimatedMinutes = patch.estimatedMinutes;

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
    subtasks: [],
    sortOrder: task.sortOrder,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
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

  const id = crypto.randomUUID();
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
      sortOrder: maxOrder + 1,
    })
    .run();

  return getPlan(input.planId);
}
