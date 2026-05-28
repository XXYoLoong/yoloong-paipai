import "server-only";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { env } from "@/lib/env";
import { runMigrations } from "@/lib/db/migrate";
import { BUILTIN_TEMPLATES } from "@/lib/templates/builtin-data";
import { stringifyJson } from "@/lib/db/json";
import { templates } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";

const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database;
  drizzle?: ReturnType<typeof drizzle<typeof schema>>;
};

function resolveSqlitePath(databaseUrl: string) {
  if (databaseUrl.startsWith("file:")) {
    return databaseUrl.replace(/^file:/, "");
  }

  return databaseUrl;
}

function createSqlite() {
  const sqlitePath = resolve(resolveSqlitePath(env.DATABASE_URL));
  mkdirSync(dirname(sqlitePath), { recursive: true });

  const sqlite = new Database(sqlitePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return sqlite;
}

export const sqlite = globalForDb.sqlite ?? createSqlite();
export const db =
  globalForDb.drizzle ??
  drizzle(sqlite, {
    schema,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlite = sqlite;
  globalForDb.drizzle = db;
}

let initialized = false;

export function initDb() {
  if (initialized) {
    return;
  }

  db.run(sql`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      original_goal TEXT NOT NULL,
      goal_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      summary TEXT NOT NULL DEFAULT '',
      assumptions_json TEXT NOT NULL DEFAULT '[]',
      follow_up_questions_json TEXT NOT NULL DEFAULT '[]',
      search_queries_json TEXT NOT NULL DEFAULT '[]',
      template_id TEXT,
      prompt_version TEXT,
      schema_version TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      parent_task_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      due_date TEXT,
      estimated_minutes INTEGER,
      evidence_ids_json TEXT NOT NULL DEFAULT '[]',
      dependency_ids_json TEXT NOT NULL DEFAULT '[]',
      completed_at TEXT,
      risk_level TEXT,
      confirm_required INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS evidence_items (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      snippet TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'SearXNG',
      query_hash TEXT NOT NULL,
      query TEXT NOT NULL,
      credibility TEXT NOT NULL DEFAULT 'unverified',
      domain TEXT,
      citation_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS search_cache (
      query_hash TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      results_json TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      plan_id TEXT REFERENCES plans(id) ON DELETE SET NULL,
      input_summary TEXT NOT NULL,
      model_name TEXT NOT NULL,
      token_usage_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL,
      error_message TEXT,
      stage_log_json TEXT NOT NULL DEFAULT '[]',
      prompt_version TEXT,
      schema_version TEXT,
      fallback_reason TEXT,
      latency_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS user_memory (
      id TEXT PRIMARY KEY,
      goal_type TEXT NOT NULL,
      preferences_json TEXT NOT NULL DEFAULT '[]',
      constraints_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      goal_type TEXT NOT NULL,
      goal_template TEXT NOT NULL,
      default_fields_json TEXT NOT NULL DEFAULT '{}',
      builtin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS plan_reviews (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      completion_rate REAL NOT NULL DEFAULT 0,
      delay_reasons_json TEXT NOT NULL DEFAULT '[]',
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS export_jobs (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      format TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      file_path TEXT,
      sensitive_flags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  runMigrations();

  for (const template of BUILTIN_TEMPLATES) {
    db.insert(templates)
      .values({
        id: template.id,
        name: template.name,
        goalType: template.goalType,
        goalTemplate: template.goalTemplate,
        defaultFieldsJson: stringifyJson(template.defaultFields),
        builtin: template.builtin ? 1 : 0,
      })
      .onConflictDoNothing()
      .run();
  }

  initialized = true;
}
