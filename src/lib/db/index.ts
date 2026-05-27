import "server-only";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { env } from "@/lib/env";
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

  initialized = true;
}

