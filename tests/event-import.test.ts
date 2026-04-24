import { describe, it, expect, beforeEach } from "vitest";
import { importEvent } from "../lib/event-import";
import type { EventAttendanceRow } from "../lib/csv-event-row";

// Minimal, hand-rolled fake that covers only the query shapes importEvent
// uses: .from(t).select(c).eq(k,v)[.maybeSingle()] / .in() / .upsert() /
// .delete().eq() / .update().eq(). Each table is a map keyed by PK.

type Table<Row extends Record<string, unknown>> = Map<string, Row>;

function makeFakeDb() {
  const events: Table<Record<string, unknown>> = new Map();
  const attendance: {
    luma_event_id: string;
    member_user_api_id: string;
    guest_api_id: string | null;
    approval_status: string;
    registered_at: string | null;
    checked_in_at: string | null;
  }[] = [];
  const members: Table<Record<string, unknown>> = new Map();

  function from(name: string) {
    if (name === "events") return eventsTable();
    if (name === "members") return membersTable();
    if (name === "event_attendance") return attendanceTable();
    throw new Error(`unexpected table: ${name}`);
  }

  function eventsTable() {
    let where: Record<string, unknown> = {};
    const chain: any = {
      select() {
        return chain;
      },
      eq(k: string, v: unknown) {
        where = { [k]: v };
        return chain;
      },
      async maybeSingle() {
        const row = [...events.values()].find(
          (r) => r.luma_event_id === where.luma_event_id,
        );
        return { data: row ?? null, error: null };
      },
      async upsert(row: any) {
        const prev = events.get(row.luma_event_id) ?? {};
        events.set(row.luma_event_id, { ...prev, ...row });
        return { data: null, error: null };
      },
    };
    return chain;
  }

  function membersTable() {
    let op: "select" | "update" | "upsert" = "select";
    let payload: any = null;
    let where: Record<string, unknown> = {};
    let inCol: string | null = null;
    let inVals: unknown[] = [];
    const chain: any = {
      select(_cols: string) {
        op = "select";
        return chain;
      },
      in(col: string, vals: unknown[]) {
        inCol = col;
        inVals = vals;
        return chain;
      },
      eq(k: string, v: unknown) {
        where = { [k]: v };
        if (op === "update") {
          const row = members.get(where.user_api_id as string);
          if (row) members.set(row.user_api_id as string, { ...row, ...payload });
        }
        return chain;
      },
      async upsert(rows: any[]) {
        op = "upsert";
        for (const r of rows) {
          const prev = members.get(r.user_api_id) ?? {};
          const merged = { ...prev, ...r };
          if (r.email) {
            (merged as any).email_normalized = String(r.email)
              .trim()
              .toLowerCase();
          }
          members.set(r.user_api_id, merged);
        }
        return { data: null, error: null };
      },
      update(p: any) {
        op = "update";
        payload = p;
        return chain;
      },
      then(resolve: (v: { data: any[]; error: null }) => void) {
        if (op === "select") {
          if (inCol) {
            const set = new Set(inVals);
            const rows = [...members.values()].filter((r) =>
              set.has(r[inCol!]),
            );
            resolve({ data: rows as any[], error: null });
          } else {
            resolve({ data: [...members.values()] as any[], error: null });
          }
        } else {
          resolve({ data: [] as any[], error: null });
        }
      },
    };
    return chain;
  }

  function attendanceTable() {
    let op: "select" | "insert" | "delete" = "select";
    let inCol: string | null = null;
    let inVals: unknown[] = [];
    let where: Record<string, unknown> = {};
    const chain: any = {
      select(_cols: string) {
        op = "select";
        return chain;
      },
      in(col: string, vals: unknown[]) {
        inCol = col;
        inVals = vals;
        return chain;
      },
      eq(k: string, v: unknown) {
        where = { [k]: v };
        if (op === "delete") {
          for (let i = attendance.length - 1; i >= 0; i--) {
            if ((attendance[i] as any)[k] === v) attendance.splice(i, 1);
          }
        }
        return chain;
      },
      async insert(rows: any[]) {
        attendance.push(...rows);
        return { data: null, error: null };
      },
      delete() {
        op = "delete";
        return chain;
      },
      then(resolve: (v: { data: any[]; error: null }) => void) {
        if (op === "select") {
          let data = attendance as any[];
          if (inCol) {
            const set = new Set(inVals);
            data = data.filter((r) => set.has(r[inCol!]));
          } else if (Object.keys(where).length > 0) {
            data = data.filter((r) =>
              Object.entries(where).every(([k, v]) => r[k] === v),
            );
          }
          resolve({ data, error: null });
        } else {
          resolve({ data: [] as any[], error: null });
        }
      },
    };
    return chain;
  }

  return { from, _tables: { events, attendance, members } };
}

const qr =
  "https://luma.com/check-in/evt-T1?pk=pkpkpk";

function row(overrides: Partial<EventAttendanceRow> = {}): EventAttendanceRow {
  return {
    luma_event_id: "evt-T1",
    guest_api_id: "gst-a",
    name: "A",
    email: "a@gsu.edu",
    registered_at: "2025-09-01T10:00:00.000Z",
    checked_in_at: null,
    approval_status: "approved",
    ...overrides,
  };
}

describe("importEvent", () => {
  let db: ReturnType<typeof makeFakeDb>;
  const noBlocked = new Set<string>();
  beforeEach(() => {
    db = makeFakeDb();
  });

  it("creates event + attendance on first import", async () => {
    const res = await importEvent(
      {
        rows: [
          row({ email: "a@x.edu", guest_api_id: "gst-a" }),
          row({
            email: "b@x.edu",
            guest_api_id: "gst-b",
            checked_in_at: "2025-09-02T20:00:00.000Z",
          }),
        ],
        filename: "Test Event.csv",
        blockedEmails: noBlocked,
      },
      { db },
    );
    expect(res.was_replacing).toBe(false);
    expect(res.approved).toBe(2);
    expect(res.checked_in).toBe(1);
    expect(res.auto_created_members).toBe(2);
    expect(res.blocked_count).toBe(0);
    expect(db._tables.events.get("evt-T1")?.name).toBe("Test Event");
    expect(db._tables.attendance.length).toBe(2);
  });

  it("re-importing the same event replaces attendance (no double-count)", async () => {
    const args = {
      rows: [row({ email: "a@x.edu", guest_api_id: "gst-a" })],
      filename: "Test Event.csv",
      blockedEmails: noBlocked,
    };
    await importEvent(args, { db });
    await importEvent(args, { db });
    expect(db._tables.attendance.length).toBe(1);
    expect(db._tables.events.size).toBe(1);
  });

  it("re-import preserves a human-edited event_date", async () => {
    await importEvent(
      {
        rows: [row({ email: "a@x.edu", guest_api_id: "gst-a" })],
        filename: "E.csv",
        blockedEmails: noBlocked,
      },
      { db },
    );
    const edited = "2025-08-15T00:00:00.000Z";
    db._tables.events.get("evt-T1")!.event_date = edited;
    await importEvent(
      {
        rows: [row({ email: "a@x.edu", guest_api_id: "gst-a" })],
        filename: "E.csv",
        blockedEmails: noBlocked,
      },
      { db },
    );
    expect(db._tables.events.get("evt-T1")?.event_date).toBe(edited);
  });

  it("matches existing member by email (doesn't create duplicate)", async () => {
    db._tables.members.set("usr_existing", {
      user_api_id: "usr_existing",
      email: "a@x.edu",
      email_normalized: "a@x.edu",
      source: "subscribed",
    });
    const res = await importEvent(
      {
        rows: [row({ email: "a@x.edu", guest_api_id: "gst-a" })],
        filename: "E.csv",
        blockedEmails: noBlocked,
      },
      { db },
    );
    expect(res.auto_created_members).toBe(0);
    expect(db._tables.attendance[0].member_user_api_id).toBe("usr_existing");
  });

  it("recomputes member counters across events", async () => {
    // Alice attends both events; Bob only one.
    await importEvent(
      {
        rows: [
          row({
            email: "alice@x.edu",
            guest_api_id: "gst-a1",
            checked_in_at: "2025-09-02T20:00:00.000Z",
          }),
          row({ email: "bob@x.edu", guest_api_id: "gst-b1" }),
        ],
        filename: "E1.csv",
        blockedEmails: noBlocked,
      },
      { db },
    );
    await importEvent(
      {
        rows: [
          {
            ...row({
              email: "alice@x.edu",
              guest_api_id: "gst-a2",
              checked_in_at: "2025-10-02T20:00:00.000Z",
            }),
            luma_event_id: "evt-T2",
          },
        ],
        filename: "E2.csv",
        blockedEmails: noBlocked,
      },
      { db },
    );
    // Members auto-created on first import are matched by email on second.
    const alice = [...db._tables.members.values()].find(
      (m) => (m as any).email === "alice@x.edu",
    ) as any;
    expect(alice.event_approved_count).toBe(2);
    expect(alice.event_checked_in_count).toBe(2);
    const bob = [...db._tables.members.values()].find(
      (m) => (m as any).email === "bob@x.edu",
    ) as any;
    expect(bob.event_approved_count).toBe(1);
    expect(bob.event_checked_in_count).toBe(0);
  });

  it("collapses multi-ticket same-email guests to a single member + attendance row", async () => {
    // Two tickets for the same person in the same event.
    const res = await importEvent(
      {
        rows: [
          row({
            email: "alice@x.edu",
            guest_api_id: "gst-ticket-1",
            name: "Alice",
            checked_in_at: "2025-09-02T20:00:00.000Z",
          }),
          row({
            email: "alice@x.edu",
            guest_api_id: "gst-ticket-2",
            name: "Alice",
          }),
        ],
        filename: "E.csv",
        blockedEmails: noBlocked,
      },
      { db },
    );
    expect(res.auto_created_members).toBe(1);
    expect(res.touched_members).toBe(1);
    expect(db._tables.attendance.length).toBe(1);
    // Exactly one member row for Alice — no orphan.
    const aliceRows = [...db._tables.members.values()].filter(
      (m) => (m as any).email === "alice@x.edu",
    );
    expect(aliceRows.length).toBe(1);
    // Event counts match the actual attendance row count.
    const event = db._tables.events.get("evt-T1") as any;
    expect(event.approved_count).toBe(1);
    expect(event.checked_in_count).toBe(1);
    expect(event.registered_count).toBe(1);
  });

  it("event counts match attendance rows when a row has no api_id and no existing member", async () => {
    // Parser ordinarily guarantees api_id, but a synthesized row with no
    // guest_api_id must not inflate the stored event counts above the
    // attendance-row count.
    const res = await importEvent(
      {
        rows: [
          row({ email: "a@x.edu", guest_api_id: "gst-a" }),
          row({ email: "ghost@x.edu", guest_api_id: null }),
        ],
        filename: "E.csv",
        blockedEmails: noBlocked,
      },
      { db },
    );
    expect(db._tables.attendance.length).toBe(1);
    expect(res.approved).toBe(1);
    expect(res.registered).toBe(1);
    const event = db._tables.events.get("evt-T1") as any;
    expect(event.registered_count).toBe(1);
    expect(event.approved_count).toBe(1);
  });

  it("skips blacklisted emails: no member created, no attendance, counts them as blocked", async () => {
    const blocked = new Set(["blocked@x.edu"]);
    const res = await importEvent(
      {
        rows: [
          row({ email: "ok@x.edu", guest_api_id: "gst-ok" }),
          row({
            email: "blocked@x.edu",
            guest_api_id: "gst-bad",
            checked_in_at: "2025-09-02T20:00:00.000Z",
          }),
        ],
        filename: "E.csv",
        blockedEmails: blocked,
      },
      { db },
    );
    expect(res.blocked_count).toBe(1);
    expect(res.approved).toBe(1); // blocked row excluded from event stats
    expect(res.checked_in).toBe(0);
    expect(res.auto_created_members).toBe(1);
    expect(db._tables.attendance.length).toBe(1);
    expect(db._tables.attendance[0].member_user_api_id).toBe("gst-ok");
    const blockedMember = [...db._tables.members.values()].find(
      (m) => (m as any).email === "blocked@x.edu",
    );
    expect(blockedMember).toBeUndefined();
    const event = db._tables.events.get("evt-T1") as any;
    expect(event.approved_count).toBe(1);
    expect(event.checked_in_count).toBe(0);
  });
});
