import { z } from "zod";
import type { PlanTask } from "@/lib/types";

export const goalInputSchema = z.object({
  goal: z.string().trim().min(8, "目标至少需要 8 个字"),
  deadline: z.string().trim().optional().or(z.literal("")),
  budget: z.coerce.number().positive().optional().or(z.literal("")),
  location: z.string().trim().optional().or(z.literal("")),
  preferences: z.array(z.string().trim().min(1)).default([]),
  constraints: z.array(z.string().trim().min(1)).default([]),
  enableSearch: z.boolean().default(true),
  qualityMode: z.enum(["fast", "quality"]).default("fast"),
  templateId: z.string().trim().optional(),
  memoryMode: z.enum(["on", "off"]).default("on"),
});

export const planTaskSchema: z.ZodType<PlanTask> = z.lazy(() =>
  z.object({
    title: z.string().min(2),
    description: z.string().min(4),
    priority: z.enum(["high", "medium", "low"]),
    status: z.enum(["todo", "doing", "done"]).default("todo"),
    dueDate: z.string().optional(),
    estimatedMinutes: z.coerce.number().int().positive().optional(),
    evidenceIds: z.array(z.string()).default([]),
    dependencyIds: z.array(z.string()).default([]),
    subtasks: z.array(planTaskSchema).default([]),
  }),
);

export const generatedPlanSchema = z.object({
  title: z.string().min(2),
  goalType: z.enum([
    "travel",
    "study",
    "event",
    "career",
    "shopping",
    "health",
    "general",
  ]),
  summary: z.string().min(6),
  assumptions: z.array(z.string()).default([]),
  followUpQuestions: z.array(z.string()).max(3).default([]),
  searchQueries: z.array(z.string()).max(3).default([]),
  tasks: z.array(planTaskSchema).min(5),
});

export const taskPatchSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  dueDate: z.string().nullable().optional(),
  estimatedMinutes: z.coerce.number().int().positive().nullable().optional(),
  dependencyIds: z.array(z.string()).optional(),
  riskLevel: z.string().nullable().optional(),
  confirmRequired: z.boolean().optional(),
});

export const planReviewSchema = z.object({
  delayReasons: z.array(z.string().trim().min(1)).default([]),
  summary: z.string().trim().min(4, "复盘摘要至少 4 个字"),
});

export const appSettingsSchema = z.object({
  defaultEnableSearch: z.boolean().optional(),
  defaultQualityMode: z.enum(["fast", "quality"]).optional(),
});

export const reorderTasksSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number().int().nonnegative(),
    }),
  ),
});
