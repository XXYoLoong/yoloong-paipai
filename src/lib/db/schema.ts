import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  originalGoal: text("original_goal").notNull(),
  goalType: text("goal_type").notNull(),
  status: text("status").notNull().default("active"),
  summary: text("summary").notNull().default(""),
  assumptionsJson: text("assumptions_json").notNull().default("[]"),
  followUpQuestionsJson: text("follow_up_questions_json").notNull().default("[]"),
  searchQueriesJson: text("search_queries_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  parentTaskId: text("parent_task_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull().default("todo"),
  dueDate: text("due_date"),
  estimatedMinutes: integer("estimated_minutes"),
  evidenceIdsJson: text("evidence_ids_json").notNull().default("[]"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const evidenceItems = sqliteTable("evidence_items", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  snippet: text("snippet").notNull().default(""),
  url: text("url").notNull(),
  source: text("source").notNull().default("SearXNG"),
  queryHash: text("query_hash").notNull(),
  query: text("query").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const searchCache = sqliteTable("search_cache", {
  queryHash: text("query_hash").primaryKey(),
  query: text("query").notNull(),
  resultsJson: text("results_json").notNull(),
  createdAtMs: integer("created_at_ms").notNull(),
});

export const agentRuns = sqliteTable("agent_runs", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => plans.id, { onDelete: "set null" }),
  inputSummary: text("input_summary").notNull(),
  modelName: text("model_name").notNull(),
  tokenUsageJson: text("token_usage_json").notNull().default("{}"),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  stageLogJson: text("stage_log_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type PlanRow = typeof plans.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type EvidenceRow = typeof evidenceItems.$inferSelect;
export type AgentRunRow = typeof agentRuns.$inferSelect;

