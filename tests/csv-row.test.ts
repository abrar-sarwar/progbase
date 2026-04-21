import { describe, it, expect } from "vitest";
import { parseRow } from "../lib/csv-row";
import type { CanonicalField } from "../lib/csv-headers";

const fullMapping: Record<string, CanonicalField> = {
  user_api_id: "user_api_id",
  name: "name",
  first_name: "first_name",
  last_name: "last_name",
  email: "email",
  first_seen: "first_seen",
  tags: "tags",
  event_approved_count: "event_approved_count",
  event_checked_in_count: "event_checked_in_count",
};

describe("parseRow", () => {
  it("parses a clean row", () => {
    const res = parseRow(
      {
        user_api_id: "usr_1",
        name: " Alice  Smith ",
        email: " Alice@GSU.edu ",
        first_seen: "2025-09-01T10:00:00Z",
        tags: "newbie",
        event_approved_count: "3",
        event_checked_in_count: "2",
      },
      fullMapping,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row).toEqual({
      user_api_id: "usr_1",
      name: "Alice Smith",
      email: "alice@gsu.edu",
      first_seen: "2025-09-01T10:00:00.000Z",
      tags: ["newbie"],
      event_approved_count: 3,
      event_checked_in_count: 2,
    });
  });

  it("errors on bad email", () => {
    const res = parseRow(
      { user_api_id: "usr_1", name: "A", email: "not-an-email" },
      fullMapping,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/email/i);
    expect(res.email).toBe("not-an-email");
  });

  it("errors on blank user_api_id", () => {
    const res = parseRow(
      { user_api_id: "   ", name: "A", email: "a@b.co" },
      fullMapping,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/user_api_id/);
  });

  it("coerces non-numeric counts to 0", () => {
    const res = parseRow(
      {
        user_api_id: "u",
        name: "N",
        email: "a@b.co",
        event_approved_count: "n/a",
        event_checked_in_count: "",
      },
      fullMapping,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.event_approved_count).toBe(0);
    expect(res.row.event_checked_in_count).toBe(0);
  });

  it("strips commas from thousands-separated counts", () => {
    const res = parseRow(
      {
        user_api_id: "u",
        name: "N",
        email: "a@b.co",
        event_approved_count: "1,234",
      },
      fullMapping,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.event_approved_count).toBe(1234);
  });

  it("coerces negative counts to 0", () => {
    const res = parseRow(
      {
        user_api_id: "u",
        name: "N",
        email: "a@b.co",
        event_approved_count: "-5",
      },
      fullMapping,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.event_approved_count).toBe(0);
  });

  it("stores bad date as null, not an error", () => {
    const res = parseRow(
      {
        user_api_id: "u",
        name: "N",
        email: "a@b.co",
        first_seen: "not-a-date",
      },
      fullMapping,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.first_seen).toBeNull();
  });

  it("synthesizes name from first_name + last_name when name is blank", () => {
    const res = parseRow(
      {
        user_api_id: "u",
        email: "a@b.co",
        first_name: "Ada",
        last_name: "Lovelace",
      },
      fullMapping,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.name).toBe("Ada Lovelace");
  });

  it("synthesizes name from first_name alone when last_name is blank", () => {
    const res = parseRow(
      { user_api_id: "u", email: "a@b.co", first_name: "Cher" },
      fullMapping,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.name).toBe("Cher");
  });

  it("errors when name, first_name, and last_name are all blank", () => {
    const res = parseRow(
      { user_api_id: "u", email: "a@b.co" },
      fullMapping,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/name/i);
  });

  it("treats missing email as null (not an error) when no value supplied", () => {
    const res = parseRow(
      { user_api_id: "u", name: "N" },
      fullMapping,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.email).toBeNull();
  });
});
