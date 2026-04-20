import { describe, it, expect } from "vitest";
import { isEboard, missingFromRoster, EBOARD } from "../lib/eboard";

const m = (name: string | null, email: string | null = null) => ({
  name,
  email,
});

describe("isEboard (name-based entries)", () => {
  it("matches unambiguous full-name entries", () => {
    expect(isEboard(m("Joey Zhang"))).toBe(true);
    expect(isEboard(m("John Sang"))).toBe(true);
    expect(isEboard(m("Abrar Sarwar"))).toBe(true);
  });

  it("matches single-word entries as standalone words", () => {
    expect(isEboard(m("Dev Sharma"))).toBe(true);
    expect(isEboard(m("Charan Patel"))).toBe(true);
    expect(isEboard(m("Taizo"))).toBe(true);
  });

  it("does not substring-match single-word entries", () => {
    // "dev" must not match "Deva"
    expect(isEboard(m("Deva Kumar"))).toBe(false);
    // "ibe" must not match "Iberia"
    expect(isEboard(m("Iberia Rodriguez"))).toBe(false);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isEboard(m("  JOEY   zhang  "))).toBe(true);
    expect(isEboard(m("abrar SARWAR"))).toBe(true);
  });
});

describe("isEboard (email-based entries)", () => {
  it("matches on exact email for ambiguous first names", () => {
    expect(isEboard(m("Jared Beresford", "jaredberesford@gmail.com"))).toBe(
      true,
    );
    expect(isEboard(m("Liam Word", "liam.word@gmail.com"))).toBe(true);
    expect(
      isEboard(m("Jamal Joshua Ford", "jamaljoshuaford23@gmail.com")),
    ).toBe(true);
    expect(isEboard(m("Phillip Sanches", "phillip-sanches@outlook.com"))).toBe(
      true,
    );
  });

  it("does NOT flag non-e-board 'jamals' (name collision guard)", () => {
    // Sarah Jamal was the motivating false-positive
    expect(isEboard(m("Sarah Jamal", "sarah.jamal@example.com"))).toBe(false);
  });

  it("does NOT flag non-e-board 'jareds' without matching email", () => {
    expect(isEboard(m("Jared Random", "jared.random@example.com"))).toBe(false);
  });

  it("email match is case-insensitive", () => {
    expect(isEboard(m("Phil Whatever", "PHILLIP-SANCHES@outlook.COM"))).toBe(
      true,
    );
  });
});

describe("isEboard (edge cases)", () => {
  it("returns false for empty name and email", () => {
    expect(isEboard(m(null, null))).toBe(false);
    expect(isEboard(m("", ""))).toBe(false);
  });

  it("still works when only name is provided", () => {
    expect(isEboard(m("Joey Zhang"))).toBe(true);
  });
});

describe("missingFromRoster", () => {
  it("returns all entries when no members supplied", () => {
    const missing = missingFromRoster([]);
    expect(missing.length).toBe(EBOARD.length);
  });

  it("filters out entries that match at least one member", () => {
    const members = [
      m("Joey Zhang"),
      m("Someone", "jaredberesford@gmail.com"),
    ];
    const missingLabels = missingFromRoster(members).map((e) => e.label);
    expect(missingLabels).not.toContain("Joey Zhang");
    expect(missingLabels).not.toContain("Jared Beresford");
    // Random e-board entry that isn't matched should still be there:
    expect(missingLabels).toContain("Taizo");
  });
});
