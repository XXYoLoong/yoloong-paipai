import "server-only";

import { eq } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { stringifyJson } from "@/lib/db/json";
import { templates } from "@/lib/db/schema";
import { BUILTIN_TEMPLATES, fillTemplateGoal } from "@/lib/templates/builtin-data";
import type { GoalTemplate, GoalType } from "@/lib/types";

export { BUILTIN_TEMPLATES, fillTemplateGoal };

export function seedBuiltinTemplates() {
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
}

export function listTemplates() {
  initDb();
  return db.select().from(templates).all().map(mapTemplateRow);
}

export function getTemplate(templateId: string) {
  initDb();
  const row = db.select().from(templates).where(eq(templates.id, templateId)).get();
  return row ? mapTemplateRow(row) : null;
}

export function mapTemplateRow(row: typeof templates.$inferSelect): GoalTemplate {
  let defaultFields: GoalTemplate["defaultFields"] = {};
  try {
    defaultFields = JSON.parse(row.defaultFieldsJson) as GoalTemplate["defaultFields"];
  } catch {
    defaultFields = {};
  }

  return {
    id: row.id,
    name: row.name,
    goalType: row.goalType as GoalType,
    goalTemplate: row.goalTemplate,
    defaultFields,
    builtin: row.builtin === 1,
  };
}
