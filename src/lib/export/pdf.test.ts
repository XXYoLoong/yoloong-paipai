import { describe, expect, it } from "vitest";
import type { PlanWithTasks } from "@/lib/types";
import { planToPdfBuffer } from "@/lib/export/pdf";

const samplePlan: PlanWithTasks = {
  id: "plan-1",
  title: "英语四级备考计划",
  originalGoal: "准备 2026 年 6 月英语四级考试",
  goalType: "study",
  status: "active",
  summary: "围绕词汇、听力、真题三轮推进。",
  assumptions: [],
  followUpQuestions: [],
  searchQueries: [],
  createdAt: "2026-05-29 00:00:00",
  updatedAt: "2026-05-29 00:00:00",
  tasks: [
    {
      id: "task-1",
      planId: "plan-1",
      title: "核心词汇积累",
      description: "每天背诵 30 个高频词。",
      priority: "high",
      status: "todo",
      dueDate: "2026-06-06",
      estimatedMinutes: 120,
      evidenceIds: [],
      dependencyIds: [],
      confirmRequired: false,
      subtasks: [],
      sortOrder: 0,
      createdAt: "2026-05-29 00:00:00",
      updatedAt: "2026-05-29 00:00:00",
    },
  ],
  evidenceItems: [],
};

describe("planToPdfBuffer", () => {
  it("generates a pdf with chinese content embedded", async () => {
    const buffer = await planToPdfBuffer(samplePlan);
    const header = buffer.subarray(0, 4).toString("utf8");
    expect(header).toBe("%PDF");
    expect(buffer.length).toBeGreaterThan(20_000);
    expect(buffer.includes(Buffer.from("????"))).toBe(false);
  });
});
