import { describe, it, expect } from "vitest";
import { mergeLumaFields } from "../lib/csv-merge";
import type { ParsedRow } from "../lib/csv-row";

function row(overrides: Partial<ParsedRow> = {}): ParsedRow {
  return {
    user_api_id: "u1",
    name: "N",
    email: "a@b.co",
    first_seen: null,
    tags: null,
    event_approved_count: 0,
    event_checked_in_count: 0,
    membership_name: null,
    membership_status: null,
    ...overrides,
  };
}

describe("mergeLumaFields", () => {
  it("new member: passes incoming through as-is, no diffs against null existing", () => {
    const incoming = row({
      event_approved_count: 3,
      first_seen: "2025-09-01T00:00:00.000Z",
    });
    const { merged, diffs } = mergeLumaFields(incoming, null);
    expect(merged.user_api_id).toBe("u1");
    expect(merged.event_approved_count).toBe(3);
    expect(merged.first_seen).toBe("2025-09-01T00:00:00.000Z");
    expect(diffs.map((d) => d.field).sort()).toEqual(
      [
        "email",
        "event_approved_count",
        "first_seen",
        "name",
      ].sort(),
    );
  });

  it("counts take MAX of existing and incoming", () => {
    const { merged } = mergeLumaFields(
      row({ event_approved_count: 2, event_checked_in_count: 1 }),
      {
        user_api_id: "u1",
        event_approved_count: 5,
        event_checked_in_count: 0,
      },
    );
    expect(merged.event_approved_count).toBe(5);
    expect(merged.event_checked_in_count).toBe(1);
  });

  it("first_seen takes the MIN (earliest) non-null value", () => {
    const { merged: later } = mergeLumaFields(
      row({ first_seen: "2025-09-15T00:00:00.000Z" }),
      { user_api_id: "u1", first_seen: "2025-09-01T00:00:00.000Z" },
    );
    expect(later.first_seen).toBe("2025-09-01T00:00:00.000Z");

    const { merged: earlier } = mergeLumaFields(
      row({ first_seen: "2025-09-01T00:00:00.000Z" }),
      { user_api_id: "u1", first_seen: "2025-09-15T00:00:00.000Z" },
    );
    expect(earlier.first_seen).toBe("2025-09-01T00:00:00.000Z");
  });

  it("first_seen: keeps existing when incoming is null", () => {
    const { merged } = mergeLumaFields(
      row({ first_seen: null }),
      { user_api_id: "u1", first_seen: "2025-09-01T00:00:00.000Z" },
    );
    expect(merged.first_seen).toBe("2025-09-01T00:00:00.000Z");
  });

  it("first_seen: takes incoming when existing is null", () => {
    const { merged } = mergeLumaFields(
      row({ first_seen: "2025-09-01T00:00:00.000Z" }),
      { user_api_id: "u1", first_seen: null },
    );
    expect(merged.first_seen).toBe("2025-09-01T00:00:00.000Z");
  });

  it("string fields prefer incoming non-null", () => {
    const { merged } = mergeLumaFields(
      row({ name: "New Name", tags: "vip" }),
      { user_api_id: "u1", name: "Old Name", tags: "regular" },
    );
    expect(merged.name).toBe("New Name");
    expect(merged.tags).toBe("vip");
  });

  it("string fields keep existing when incoming is null", () => {
    const { merged } = mergeLumaFields(
      row({ name: "N", tags: null, membership_name: null }),
      {
        user_api_id: "u1",
        name: "N",
        tags: "keep-me",
        membership_name: "Pro",
      },
    );
    expect(merged.tags).toBe("keep-me");
    expect(merged.membership_name).toBe("Pro");
  });

  it("merged write-set never contains editable fields", () => {
    const { merged } = mergeLumaFields(row(), {
      user_api_id: "u1",
      name: "N",
      email: "a@b.co",
    });
    const keys = Object.keys(merged);
    for (const editable of [
      "description",
      "major",
      "grad_year",
      "gender",
      "pronouns",
      "linkedin_url",
      "custom_tags",
      "hidden",
      "updated_by",
      "updated_at",
    ]) {
      expect(keys).not.toContain(editable);
    }
  });

  it("diffs are empty when merged equals existing", () => {
    const existing = {
      user_api_id: "u1",
      name: "N",
      email: "a@b.co",
      first_seen: "2025-09-01T00:00:00.000Z",
      tags: null,
      event_approved_count: 5,
      event_checked_in_count: 3,
      membership_name: null,
      membership_status: null,
    };
    const { diffs } = mergeLumaFields(
      row({
        name: "N",
        email: "a@b.co",
        first_seen: "2025-09-15T00:00:00.000Z",
        event_approved_count: 2,
        event_checked_in_count: 1,
      }),
      existing,
    );
    expect(diffs).toEqual([]);
  });

  it("diff includes old and new values for changed fields", () => {
    const { diffs } = mergeLumaFields(
      row({ name: "New", email: "new@b.co", event_approved_count: 10 }),
      {
        user_api_id: "u1",
        name: "Old",
        email: "old@b.co",
        event_approved_count: 3,
      },
    );
    const byField = Object.fromEntries(diffs.map((d) => [d.field, d]));
    expect(byField.name).toEqual({ field: "name", old: "Old", new: "New" });
    expect(byField.email).toEqual({
      field: "email",
      old: "old@b.co",
      new: "new@b.co",
    });
    expect(byField.event_approved_count).toEqual({
      field: "event_approved_count",
      old: 3,
      new: 10,
    });
  });
});
