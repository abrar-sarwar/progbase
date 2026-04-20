import { describe, it, expect } from "vitest";
import { parseLumaCsv } from "../lib/csv";

const header =
  "name,first_name,last_name,email,first_seen,user_api_id,tags,event_approved_count,event_checked_in_count,membership_name,membership_status";

function buf(csv: string): Buffer {
  return Buffer.from(csv, "utf-8");
}

describe("parseLumaCsv", () => {
  it("parses a valid row and ignores extra columns", () => {
    const csv = `${header}\nAlice,Alice,A,alice@gsu.edu,2025-09-01T10:00:00Z,usr_1,tagA,3,2,m,active`;
    const res = parseLumaCsv(buf(csv));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toEqual({
      user_api_id: "usr_1",
      name: "Alice",
      email: "alice@gsu.edu",
      first_seen: "2025-09-01T10:00:00.000Z",
      event_approved_count: 3,
      event_checked_in_count: 2,
    });
  });

  it("strips leading BOM", () => {
    const csv = `\uFEFF${header}\nBob,Bob,B,bob@gsu.edu,2025-09-02,usr_2,,1,0,,`;
    const res = parseLumaCsv(buf(csv));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows[0].name).toBe("Bob");
  });

  it("coerces blank event counts to 0", () => {
    const csv = `${header}\nC,C,C,c@g,2025-09-02,usr_3,,,,,`;
    const res = parseLumaCsv(buf(csv));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows[0].event_approved_count).toBe(0);
    expect(res.rows[0].event_checked_in_count).toBe(0);
  });

  it("reports missing required columns", () => {
    const res = parseLumaCsv(buf("name,email\nA,a@g"));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.missing).toContain("user_api_id");
    }
  });

  it("skips rows with blank user_api_id and records an error", () => {
    const csv = `${header}\nA,A,A,a@g,2025-09-01,,,1,1,,\nB,B,B,b@g,2025-09-02,usr_b,,1,1,,`;
    const res = parseLumaCsv(buf(csv));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toHaveLength(1);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].reason).toMatch(/user_api_id/);
  });

  it("last duplicate user_api_id wins", () => {
    const csv = `${header}\nA1,A,A,a@g,2025-09-01,dup,,1,1,,\nA2,A,A,a@g,2025-09-01,dup,,5,5,,`;
    const res = parseLumaCsv(buf(csv));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].name).toBe("A2");
    expect(res.rows[0].event_approved_count).toBe(5);
  });

  it("stores unparseable first_seen as null, not an error", () => {
    const csv = `${header}\nA,A,A,a@g,not-a-date,usr_1,,1,1,,`;
    const res = parseLumaCsv(buf(csv));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows[0].first_seen).toBeNull();
    expect(res.errors).toHaveLength(0);
  });
});
