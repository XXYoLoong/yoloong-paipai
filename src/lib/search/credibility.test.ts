import { describe, expect, it } from "vitest";
import { scoreCredibility } from "@/lib/search/credibility";

describe("credibility", () => {
  it("scores edu domain as high", () => {
    const result = scoreCredibility({
      url: "https://www.tsinghua.edu.cn/info",
      title: "招生简章",
      snippet: "x".repeat(90),
      source: "google",
      seenUrls: new Set(),
    });
    expect(result.credibility).toBe("high");
  });

  it("marks duplicate url as low", () => {
    const seen = new Set<string>();
    scoreCredibility({
      url: "https://example.com/a",
      title: "A",
      snippet: "short",
      source: "bing",
      seenUrls: seen,
    });
    const dup = scoreCredibility({
      url: "https://example.com/a",
      title: "A2",
      snippet: "short",
      source: "bing",
      seenUrls: seen,
    });
    expect(dup.credibility).toBe("low");
  });
});
