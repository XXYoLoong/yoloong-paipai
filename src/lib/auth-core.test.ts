import { describe, expect, it } from "vitest";
import { isAuthEnabledFromHash, normalizePasswordHash } from "@/lib/auth-core";

describe("auth-core", () => {
  it("rejects empty hash", () => {
    expect(isAuthEnabledFromHash(undefined)).toBe(false);
  });

  it("normalizes sha256 prefix", () => {
    const hash = "a".repeat(64);
    expect(normalizePasswordHash(`sha256:${hash}`)).toBe(hash);
  });
});
