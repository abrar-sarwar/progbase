import { describe, it, expect } from "vitest";
import { isAllowed } from "../lib/allowlist";

describe("isAllowed", () => {
  it("returns true for an exact-match allowlisted email", () => {
    expect(isAllowed("a@gsu.edu", "a@gsu.edu,b@gsu.edu")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isAllowed("A@GSU.edu", "a@gsu.edu")).toBe(true);
  });

  it("trims whitespace around entries", () => {
    expect(isAllowed("a@gsu.edu", " a@gsu.edu , b@gsu.edu ")).toBe(true);
  });

  it("trims whitespace on the input email", () => {
    expect(isAllowed("  a@gsu.edu  ", "a@gsu.edu")).toBe(true);
  });

  it("returns false when not present", () => {
    expect(isAllowed("c@gsu.edu", "a@gsu.edu,b@gsu.edu")).toBe(false);
  });

  it("returns false for empty allowlist (fail-closed)", () => {
    expect(isAllowed("a@gsu.edu", "")).toBe(false);
    expect(isAllowed("a@gsu.edu", undefined)).toBe(false);
  });

  it("returns false for empty email", () => {
    expect(isAllowed("", "a@gsu.edu")).toBe(false);
    expect(isAllowed(null, "a@gsu.edu")).toBe(false);
    expect(isAllowed(undefined, "a@gsu.edu")).toBe(false);
  });

  it("ignores empty entries caused by trailing commas", () => {
    expect(isAllowed("a@gsu.edu", "a@gsu.edu,,")).toBe(true);
    expect(isAllowed("", "a@gsu.edu,,")).toBe(false);
  });
});
