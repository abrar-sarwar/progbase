import { describe, it, expect } from "vitest";
import { mapHeaders } from "../lib/csv-headers";

describe("mapHeaders", () => {
  it("maps exact Luma headers", () => {
    const res = mapHeaders([
      "user_api_id",
      "name",
      "email",
      "first_seen",
      "tags",
      "event_approved_count",
      "event_checked_in_count",
      "membership_name",
      "membership_status",
    ]);
    expect(res.missingRequired).toEqual([]);
    expect(res.unmapped).toEqual([]);
    expect(res.mapping).toEqual({
      user_api_id: "user_api_id",
      name: "name",
      email: "email",
      first_seen: "first_seen",
      tags: "tags",
      event_approved_count: "event_approved_count",
      event_checked_in_count: "event_checked_in_count",
      membership_name: "membership_name",
      membership_status: "membership_status",
    });
  });

  it("handles case and whitespace variants", () => {
    const res = mapHeaders(["User API ID", " Name ", "EMAIL", "First  Seen"]);
    expect(res.mapping["User API ID"]).toBe("user_api_id");
    expect(res.mapping[" Name "]).toBe("name");
    expect(res.mapping["EMAIL"]).toBe("email");
    expect(res.mapping["First  Seen"]).toBe("first_seen");
  });

  it("accepts aliases", () => {
    const res = mapHeaders([
      "api_id",
      "full_name",
      "e-mail",
      "joined_at",
      "labels",
      "rsvp_count",
      "checkins",
      "plan",
      "status",
    ]);
    expect(res.missingRequired).toEqual([]);
    expect(res.mapping["api_id"]).toBe("user_api_id");
    expect(res.mapping["full_name"]).toBe("name");
    expect(res.mapping["e-mail"]).toBe("email");
    expect(res.mapping["joined_at"]).toBe("first_seen");
    expect(res.mapping["labels"]).toBe("tags");
    expect(res.mapping["rsvp_count"]).toBe("event_approved_count");
    expect(res.mapping["checkins"]).toBe("event_checked_in_count");
    expect(res.mapping["plan"]).toBe("membership_name");
    expect(res.mapping["status"]).toBe("membership_status");
  });

  it("is insensitive to column order", () => {
    const res = mapHeaders(["email", "name", "user_api_id"]);
    expect(res.missingRequired).toEqual([]);
    expect(res.mapping).toEqual({
      email: "email",
      name: "name",
      user_api_id: "user_api_id",
    });
  });

  it("puts unknown headers into unmapped without erroring", () => {
    const res = mapHeaders([
      "user_api_id",
      "name",
      "email",
      "phone",
      "source",
      "utm_campaign",
    ]);
    expect(res.missingRequired).toEqual([]);
    expect(res.unmapped).toEqual(["phone", "source", "utm_campaign"]);
  });

  it("reports missing required fields", () => {
    const res = mapHeaders(["name", "email"]);
    expect(res.missingRequired).toEqual(["user_api_id"]);
  });

  it("reports all missing required fields when multiple are absent", () => {
    const res = mapHeaders(["first_seen"]);
    expect(res.missingRequired).toEqual(["user_api_id", "name", "email"]);
  });

  it("prefers the exact canonical-name header when multiple aliases collide", () => {
    const res = mapHeaders(["email_address", "email", "user_api_id", "name"]);
    expect(res.mapping["email"]).toBe("email");
    expect(res.mapping["email_address"]).toBeUndefined();
    expect(res.unmapped).toContain("email_address");
  });

  it("falls back to first-encountered when no exact canonical match", () => {
    const res = mapHeaders([
      "email_address",
      "e_mail",
      "user_api_id",
      "name",
    ]);
    expect(res.mapping["email_address"]).toBe("email");
    expect(res.mapping["e_mail"]).toBeUndefined();
    expect(res.unmapped).toContain("e_mail");
  });

  it("strips surrounding quotes from CSV headers", () => {
    const res = mapHeaders([`"user_api_id"`, `'name'`, `"email"`]);
    expect(res.missingRequired).toEqual([]);
    expect(res.mapping[`"user_api_id"`]).toBe("user_api_id");
    expect(res.mapping[`'name'`]).toBe("name");
    expect(res.mapping[`"email"`]).toBe("email");
  });
});
