import { describe, expect, it } from "vitest";
import { applyDueDatesToPlan, normalizePlanSchedule, remapDependencyIds } from "@/lib/agent/due-dates";
import { parseModelJson } from "@/lib/agent/parse-model-json";

describe("parseModelJson", () => {
  it("parses fenced json", () => {
    const parsed = parseModelJson('```json\n{"title":"测试","goalType":"general"}\n```') as { title: string };
    expect(parsed.title).toBe("测试");
  });

  it("repairs truncated json with unterminated string", () => {
    const broken = `{
  "title": "测试计划",
  "goalType": "travel",
  "summary": "summary",
  "assumptions": [],
  "followUpQuestions": [],
  "searchQueries": [],
  "tasks": [
    {
      "title": "第一步",
      "description": "未闭合描述`;
    const parsed = parseModelJson(broken) as { tasks?: Array<{ title?: string }> };
    expect(parsed.tasks?.[0]?.title).toBe("第一步");
  });
});

describe("normalizePlanSchedule", () => {
  const now = new Date("2026-05-28T10:00:00");

  it("assigns due dates when goal deadline is provided", () => {
    const plan = normalizePlanSchedule(
      {
        title: "测试",
        goalType: "travel",
        summary: "summary",
        assumptions: [],
        followUpQuestions: [],
        searchQueries: [],
        tasks: [
          { title: "A", description: "a", priority: "high", status: "todo", subtasks: [] },
          { title: "B", description: "b", priority: "medium", status: "todo", subtasks: [] },
        ],
      },
      { deadline: "2026-12-31", now },
    );

    expect(plan.tasks[0]?.dueDate).toMatch(/^2026-/);
    expect(plan.tasks[1]?.dueDate).toMatch(/^2026-/);
    expect(plan.tasks[0]?.dueDate! <= plan.tasks[1]?.dueDate!).toBe(true);
  });

  it("overrides past model due dates when deadline is provided", () => {
    const plan = normalizePlanSchedule(
      {
        title: "四级备考",
        goalType: "study",
        summary: "summary",
        assumptions: [],
        followUpQuestions: [],
        searchQueries: [],
        tasks: [
          { title: "词汇", description: "a", priority: "high", status: "todo", dueDate: "2025-10-12", subtasks: [] },
          { title: "听力", description: "b", priority: "high", status: "todo", dueDate: "2025-11-09", subtasks: [] },
        ],
      },
      { deadline: "2026-06-20", now },
    );

    expect(plan.tasks[0]?.dueDate).toBe("2026-06-09");
    expect(plan.tasks[1]?.dueDate).toBe("2026-06-20");
    expect(plan.assumptions.some((item) => item.includes("重新分配"))).toBe(true);
  });

  it("clears past due dates when no deadline is provided", () => {
    const plan = normalizePlanSchedule(
      {
        title: "测试",
        goalType: "study",
        summary: "summary",
        assumptions: [],
        followUpQuestions: [],
        searchQueries: [],
        tasks: [{ title: "A", description: "a", priority: "high", status: "todo", dueDate: "2025-01-01", subtasks: [] }],
      },
      { now },
    );

    expect(plan.tasks[0]?.dueDate).toBeUndefined();
  });
});

describe("applyDueDatesToPlan", () => {
  it("keeps compatibility alias", () => {
    const plan = applyDueDatesToPlan(
      {
        title: "测试",
        goalType: "travel",
        summary: "summary",
        assumptions: [],
        followUpQuestions: [],
        searchQueries: [],
        tasks: [{ title: "A", description: "a", priority: "high", status: "todo", subtasks: [] }],
      },
      "2026-12-31",
    );
    expect(plan.tasks[0]?.dueDate).toMatch(/^2026-/);
  });
});

describe("remapDependencyIds", () => {
  it("maps temporary model ids to persisted ids", () => {
    const idMap = new Map([
      ["t1", "uuid-1"],
      ["t2", "uuid-2"],
    ]);
    const validIds = new Set(["uuid-1", "uuid-2"]);
    expect(remapDependencyIds(["t1"], idMap, validIds)).toEqual(["uuid-1"]);
  });

  it("drops orphan dependency ids", () => {
    const idMap = new Map([["t1", "uuid-1"]]);
    const validIds = new Set(["uuid-1"]);
    expect(remapDependencyIds(["ghost"], idMap, validIds)).toEqual([]);
  });
});
