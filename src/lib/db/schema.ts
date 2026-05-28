import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  templateId: text("template_id"),
  promptVersion: text("prompt_version"),
  schemaVersion: text("schema_version"),
  archivedAt: text("archived_at"),
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
  dependencyIdsJson: text("dependency_ids_json").notNull().default("[]"),
  completedAt: text("completed_at"),
  riskLevel: text("risk_level"),
  confirmRequired: integer("confirm_required").notNull().default(0),
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
  credibility: text("credibility").notNull().default("unverified"),
  domain: text("domain"),
  citationReason: text("citation_reason"),
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
  promptVersion: text("prompt_version"),
  schemaVersion: text("schema_version"),
  fallbackReason: text("fallback_reason"),
  latencyMs: integer("latency_ms"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const userMemory = sqliteTable("user_memory", {
  id: text("id").primaryKey(),
  goalType: text("goal_type").notNull(),
  preferencesJson: text("preferences_json").notNull().default("[]"),
  constraintsJson: text("constraints_json").notNull().default("[]"),
  notes: text("notes").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  goalType: text("goal_type").notNull(),
  goalTemplate: text("goal_template").notNull(),
  defaultFieldsJson: text("default_fields_json").notNull().default("{}"),
  builtin: integer("builtin").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const planReviews = sqliteTable("plan_reviews", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  completionRate: real("completion_rate").notNull().default(0),
  delayReasonsJson: text("delay_reasons_json").notNull().default("[]"),
  summary: text("summary").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const exportJobs = sqliteTable("export_jobs", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  format: text("format").notNull(),
  status: text("status").notNull().default("pending"),
  filePath: text("file_path"),
  sensitiveFlagsJson: text("sensitive_flags_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type PlanRow = typeof plans.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type EvidenceRow = typeof evidenceItems.$inferSelect;
export type AgentRunRow = typeof agentRuns.$inferSelect;
export type TemplateRow = typeof templates.$inferSelect;
export type PlanReviewRow = typeof planReviews.$inferSelect;
