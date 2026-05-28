import { describe, expect, it } from "vitest";
import { detectSensitiveInput, inferGoalType } from "@/lib/agent/heuristics";

describe("heuristics", () => {
  it("infers travel goal type", () => {
    expect(inferGoalType("策划北京周末游")).toBe("travel");
  });

  it("detects phone in goal", () => {
    expect(detectSensitiveInput("联系我13800138000")).toBe(true);
  });
});
