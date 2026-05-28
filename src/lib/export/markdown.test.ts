import { describe, expect, it } from "vitest";
import { planToMarkdown } from "@/lib/export/markdown";
import type { PlanWithTasks } from "@/lib/types";

const samplePlan: PlanWithTasks = {
  id: "p1",
  title: "测试计划",
  originalGoal: "测试目标",
  goalType: "general",
  status: "active",
  summary: "摘要",
  assumptions: [],
  followUpQuestions: [],
  searchQueries: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  evidenceItems: [],
  tasks: [
    {
      id: "t1",
      planId: "p1",
      title: "主任务",
      description: "说明",
      priority: "high",
      status: "todo",
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
      subtasks: [],
    },
    {
      id: "t2",
      planId: "p1",
      parentTaskId: "t1",
      title: "子任务",
      description: "子说明",
      priority: "medium",
      status: "todo",
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
      subtasks: [],
    },
  ],
};

describe("planToMarkdown", () => {
  it("includes nested subtasks", () => {
    const md = planToMarkdown(samplePlan);
    expect(md).toContain("子任务");
    expect(md).toContain("主任务");
  });
});
