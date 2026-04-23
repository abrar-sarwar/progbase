import { describe, it, expect } from "vitest";
import { detectFormat } from "../lib/csv-format";

describe("detectFormat", () => {
  it("detects the event guest export", () => {
    expect(
      detectFormat([
        "api_id",
        "name",
        "first_name",
        "last_name",
        "email",
        "phone_number",
        "created_at",
        "approval_status",
        "checked_in_at",
        "utm_source",
        "qr_code_url",
        "amount",
        "ticket_name",
      ]),
    ).toBe("event");
  });

  it("detects the calendar-subscribed export", () => {
    expect(
      detectFormat([
        "user_api_id",
        "name",
        "email",
        "first_seen",
        "tags",
        "event_approved_count",
        "event_checked_in_count",
        "membership_name",
        "membership_status",
      ]),
    ).toBe("subscribed");
  });

  it("detects subscribed by alias (rsvp_count only)", () => {
    expect(detectFormat(["user_api_id", "name", "email", "rsvp_count"])).toBe(
      "subscribed",
    );
  });

  it("prefers 'event' when event indicators present even if api_id is used as alias", () => {
    expect(
      detectFormat(["api_id", "email", "approval_status", "qr_code_url"]),
    ).toBe("event");
  });

  it("returns 'unknown' for headers matching neither format", () => {
    expect(detectFormat(["foo", "bar", "baz"])).toBe("unknown");
  });

  it("returns 'unknown' for an empty header list", () => {
    expect(detectFormat([])).toBe("unknown");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(
      detectFormat(["API_ID", " Approval Status ", "qr_code_url", "email"]),
    ).toBe("event");
  });
});
