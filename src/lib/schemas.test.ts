import { describe, expect, it } from "vitest";
import { generatedPlanSchema, goalInputSchema } from "@/lib/schemas";

describe("schemas", () => {
  it("parses goal input", () => {
    const parsed = goalInputSchema.parse({
      goal: "策划三天北京周末游",
      enableSearch: true,
      memoryMode: "on",
    });
    expect(parsed.goal.length).toBeGreaterThanOrEqual(8);
  });

  it("rejects plan with too few tasks", () => {
    const result = generatedPlanSchema.safeParse({
      title: "测试",
      goalType: "general",
      summary: "摘要足够长",
      assumptions: [],
      followUpQuestions: [],
      searchQueries: [],
      tasks: [
        {
          title: "唯一任务",
          description: "说明足够长",
          priority: "medium",
          status: "todo",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
