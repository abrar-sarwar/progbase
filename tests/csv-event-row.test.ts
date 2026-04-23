import { describe, it, expect } from "vitest";
import { parseEventRow } from "../lib/csv-event-row";

const qr =
  "https://luma.com/check-in/evt-ABC123DEF?pk=g-xxyy";

describe("parseEventRow", () => {
  it("parses a clean row", () => {
    const res = parseEventRow({
      api_id: "gst-1",
      name: "Alice Smith",
      first_name: "Alice",
      last_name: "Smith",
      email: " Alice@GSU.edu ",
      phone_number: "404-555-0101",
      created_at: "2025-09-01T10:00:00Z",
      approval_status: "Approved",
      checked_in_at: "2025-09-02T20:00:00Z",
      utm_source: "",
      qr_code_url: qr,
      amount: "0",
      ticket_name: "General",
      "GSU Email?": "alice@gsu.edu", // custom — must be ignored
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row).toEqual({
      luma_event_id: "evt-ABC123DEF",
      guest_api_id: "gst-1",
      name: "Alice Smith",
      email: "alice@gsu.edu",
      registered_at: "2025-09-01T10:00:00.000Z",
      checked_in_at: "2025-09-02T20:00:00.000Z",
      approval_status: "approved",
    });
  });

  it("reports custom columns as unmapped via a separate helper", () => {
    // The row parser itself doesn't collect unmapped headers — that's the
    // caller's job (see Task 6). Here we only verify the parser doesn't
    // propagate custom fields into the output row.
    const res = parseEventRow({
      api_id: "gst-1",
      email: "a@b.co",
      approval_status: "invited",
      qr_code_url: qr,
      "Weird Custom Q": "yes",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Object.keys(res.row)).toEqual([
      "luma_event_id",
      "guest_api_id",
      "name",
      "email",
      "registered_at",
      "checked_in_at",
      "approval_status",
    ]);
  });

  it("errors on missing email", () => {
    const res = parseEventRow({
      api_id: "gst-1",
      approval_status: "invited",
      qr_code_url: qr,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/email/i);
  });

  it("errors on missing qr_code_url", () => {
    const res = parseEventRow({
      api_id: "gst-1",
      email: "a@b.co",
      approval_status: "invited",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/qr_code_url|event id/i);
  });

  it("errors on unrecognizable qr_code_url", () => {
    const res = parseEventRow({
      api_id: "gst-1",
      email: "a@b.co",
      approval_status: "invited",
      qr_code_url: "https://example.com/not-a-check-in-link",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/evt-/);
  });

  it("errors on invalid approval_status", () => {
    const res = parseEventRow({
      api_id: "gst-1",
      email: "a@b.co",
      approval_status: "waitlist",
      qr_code_url: qr,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/approval_status/i);
  });

  it("stores a null checked_in_at for no-shows", () => {
    const res = parseEventRow({
      api_id: "gst-1",
      email: "a@b.co",
      approval_status: "approved",
      qr_code_url: qr,
      checked_in_at: "",
      created_at: "2025-09-01T10:00:00Z",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.checked_in_at).toBeNull();
  });

  it("synthesizes name from first_name + last_name when name is blank", () => {
    const res = parseEventRow({
      api_id: "gst-1",
      email: "a@b.co",
      approval_status: "approved",
      qr_code_url: qr,
      first_name: "Ada",
      last_name: "Lovelace",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.name).toBe("Ada Lovelace");
  });

  it("lowercases email", () => {
    const res = parseEventRow({
      api_id: "gst-1",
      email: "A.L@GSU.EDU",
      approval_status: "approved",
      qr_code_url: qr,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.email).toBe("a.l@gsu.edu");
  });
});
