import "server-only";

import { sqlite } from "@/lib/db";

export function runMigrations() {
  const alters = [
    "ALTER TABLE plans ADD COLUMN template_id TEXT",
    "ALTER TABLE plans ADD COLUMN prompt_version TEXT",
    "ALTER TABLE plans ADD COLUMN schema_version TEXT",
    "ALTER TABLE plans ADD COLUMN archived_at TEXT",
    "ALTER TABLE tasks ADD COLUMN dependency_ids_json TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE tasks ADD COLUMN completed_at TEXT",
    "ALTER TABLE tasks ADD COLUMN risk_level TEXT",
    "ALTER TABLE tasks ADD COLUMN confirm_required INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE evidence_items ADD COLUMN credibility TEXT NOT NULL DEFAULT 'unverified'",
    "ALTER TABLE evidence_items ADD COLUMN domain TEXT",
    "ALTER TABLE evidence_items ADD COLUMN citation_reason TEXT",
    "ALTER TABLE agent_runs ADD COLUMN prompt_version TEXT",
    "ALTER TABLE agent_runs ADD COLUMN schema_version TEXT",
    "ALTER TABLE agent_runs ADD COLUMN fallback_reason TEXT",
    "ALTER TABLE agent_runs ADD COLUMN latency_ms INTEGER",
  ];

  for (const statement of alters) {
    try {
      sqlite.exec(statement);
    } catch {
      // column already exists
    }
  }
}
