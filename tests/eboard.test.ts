import { describe, it, expect } from "vitest";
import { isEboard } from "../lib/eboard";

describe("isEboard", () => {
  it("matches multi-word entries when all words appear", () => {
    expect(isEboard("Joey Zhang")).toBe(true);
    expect(isEboard("Abrar Sarwar")).toBe(true);
    expect(isEboard("John Sang")).toBe(true);
  });

  it("matches single-word entries as standalone words only", () => {
    expect(isEboard("Dev Sharma")).toBe(true);
    expect(isEboard("Charan Patel")).toBe(true);
    expect(isEboard("Jared")).toBe(true);
  });

  it("does not fuzzy-match single-word entries as substrings", () => {
    // "dev" should NOT match "Deva Kumar"
    expect(isEboard("Deva Kumar")).toBe(false);
    // "ibe" should NOT match "Iberia Rodriguez"
    expect(isEboard("Iberia Rodriguez")).toBe(false);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isEboard("  JOEY   zhang  ")).toBe(true);
    expect(isEboard("abrar SARWAR")).toBe(true);
  });

  it("returns false for empty/null/undefined input", () => {
    expect(isEboard(null)).toBe(false);
    expect(isEboard(undefined)).toBe(false);
    expect(isEboard("")).toBe(false);
    expect(isEboard("   ")).toBe(false);
  });

  it("returns false for a member not on the e-board", () => {
    expect(isEboard("Random Person")).toBe(false);
    expect(isEboard("Alice Nguyen")).toBe(false);
  });
});
