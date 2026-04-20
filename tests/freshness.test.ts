import { describe, it, expect } from "vitest";
import { isStale, staleDays } from "../lib/freshness-utils";

const now = new Date("2026-04-19T12:00:00Z").getTime();
const days = (n: number) => new Date(now - n * 86_400_000).toISOString();

describe("staleDays", () => {
  it("returns 0 for a same-day import", () => {
    expect(staleDays(days(0), now)).toBe(0);
  });
  it("returns floor of days elapsed", () => {
    expect(staleDays(days(3), now)).toBe(3);
    expect(staleDays(days(7), now)).toBe(7);
    expect(staleDays(days(10.9), now)).toBe(10);
  });
  it("returns null for missing input", () => {
    expect(staleDays(null, now)).toBeNull();
  });
});

describe("isStale", () => {
  it("is false within 7 days", () => {
    expect(isStale(days(6), now)).toBe(false);
    expect(isStale(days(7), now)).toBe(false);
  });
  it("is true beyond 7 days", () => {
    expect(isStale(days(8), now)).toBe(true);
    expect(isStale(days(30), now)).toBe(true);
  });
  it("is false when there is no prior import", () => {
    expect(isStale(null, now)).toBe(false);
  });
});
