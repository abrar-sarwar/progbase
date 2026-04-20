import { describe, it, expect } from "vitest";
import {
  isEboard,
  missingFromRoster,
  EBOARD_SEED,
  type EboardEntry,
} from "../lib/eboard";

const m = (name: string | null, email: string | null = null) => ({
  name,
  email,
});

const SEED: readonly EboardEntry[] = EBOARD_SEED;

describe("isEboard (name-based entries)", () => {
  it("matches unambiguous full-name entries", () => {
    expect(isEboard(m("Joey Zhang"), SEED)).toBe(true);
    expect(isEboard(m("John Sang"), SEED)).toBe(true);
    expect(isEboard(m("Abrar Sarwar"), SEED)).toBe(true);
  });

  it("matches single-word entries as standalone words", () => {
    expect(isEboard(m("Dev Sharma"), SEED)).toBe(true);
    expect(isEboard(m("Charan Patel"), SEED)).toBe(true);
    expect(isEboard(m("Taizo"), SEED)).toBe(true);
  });

  it("does not substring-match single-word entries", () => {
    expect(isEboard(m("Deva Kumar"), SEED)).toBe(false);
    expect(isEboard(m("Iberia Rodriguez"), SEED)).toBe(false);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isEboard(m("  JOEY   zhang  "), SEED)).toBe(true);
    expect(isEboard(m("abrar SARWAR"), SEED)).toBe(true);
  });
});

describe("isEboard (email-based entries)", () => {
  it("matches on exact email for ambiguous first names", () => {
    expect(
      isEboard(m("Jared Beresford", "jaredberesford@gmail.com"), SEED),
    ).toBe(true);
    expect(isEboard(m("Liam Word", "liam.word@gmail.com"), SEED)).toBe(true);
    expect(
      isEboard(m("Jamal Joshua Ford", "jamaljoshuaford23@gmail.com"), SEED),
    ).toBe(true);
    expect(
      isEboard(m("Phillip Sanches", "phillip-sanches@outlook.com"), SEED),
    ).toBe(true);
  });

  it("does NOT flag non-e-board 'jamals' (name collision guard)", () => {
    expect(
      isEboard(m("Sarah Jamal", "sarah.jamal@example.com"), SEED),
    ).toBe(false);
  });

  it("does NOT flag non-e-board 'jareds' without matching email", () => {
    expect(
      isEboard(m("Jared Random", "jared.random@example.com"), SEED),
    ).toBe(false);
  });

  it("email match is case-insensitive", () => {
    expect(
      isEboard(m("Phil Whatever", "PHILLIP-SANCHES@outlook.COM"), SEED),
    ).toBe(true);
  });
});

describe("isEboard (edge cases)", () => {
  it("returns false for empty name and email", () => {
    expect(isEboard(m(null, null), SEED)).toBe(false);
    expect(isEboard(m("", ""), SEED)).toBe(false);
  });

  it("still works when only name is provided", () => {
    expect(isEboard(m("Joey Zhang"), SEED)).toBe(true);
  });

  it("returns false when entries list is empty", () => {
    expect(isEboard(m("Joey Zhang"), [])).toBe(false);
  });
});

describe("missingFromRoster", () => {
  it("returns all entries when no members supplied", () => {
    const missing = missingFromRoster([], SEED);
    expect(missing.length).toBe(SEED.length);
  });

  it("filters out entries that match at least one member", () => {
    const members = [
      m("Joey Zhang"),
      m("Someone", "jaredberesford@gmail.com"),
    ];
    const missingLabels = missingFromRoster(members, SEED).map((e) => e.label);
    expect(missingLabels).not.toContain("Joey Zhang");
    expect(missingLabels).not.toContain("Jared Beresford");
    expect(missingLabels).toContain("Taizo");
  });
});
