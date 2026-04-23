# Progbase Events + Multi-CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also invoke superpowers:test-driven-development on every task that writes production code, and superpowers:using-git-worktrees at the start to set up an isolated workspace. **Do NOT push to the remote — the user will review manually.**

**Goal:** Teach `/import` to accept multiple Luma CSV files at once, auto-detect two distinct formats (calendar-subscribed export vs. per-event guest export), and surface a first-class Events section with a timeline, per-event detail page, per-member event history, and an attendance-over-time analytics chart.

**Architecture:** Two parallel parsing pipelines share one orchestration layer.

- `lib/csv-format.ts` dispatches on the first-row headers. `lib/csv-row.ts` + `lib/csv-merge.ts` keep handling subscribed exports exactly as today. A new `lib/csv-event-row.ts` handles event-guest rows. `lib/event-import.ts` owns the per-event orchestration (upsert event row → delete-and-replace `event_attendance` → auto-create unknown members by email → recompute `members.event_*_count` for every member the import touched).
- The server action `app/(protected)/import/actions.ts` accepts `File[]`, generates one `batch_id` (uuid) per upload, dispatches per-file (independent success/failure), and returns a per-file result array. Each file becomes its own `luma_imports` row; the `batch_id` just groups them in history.
- A new `events` + `event_attendance` pair of tables is the source of truth for the event-centric views. The denormalized `members.event_approved_count` / `event_checked_in_count` stay as a read-path optimization; the event-import path rewrites them from `event_attendance`, and the subscribed-CSV path continues to write them straight from the CSV aggregates (latest wins — reconciliation is an explicit followup).
- The Events section is three pages (`/events`, `/events/[id]`, an event-date override server action) + two new charts. The member detail page gains an Event History section; the analytics page gains one new chart.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase (service-role), NextAuth, papaparse, recharts, vitest.

---

## File structure

### Create

- `supabase/migrations/0004_events_and_multi_csv.sql` — idempotent additive schema.
- `lib/csv-format.ts` — `detectFormat(headers)` → `"subscribed" | "event" | "unknown"`.
- `lib/csv-event-row.ts` — pure: parse one event-CSV row → `EventAttendanceRow` or per-row error.
- `lib/event-import.ts` — server helper: orchestrate a single event CSV (upsert event, replace attendance, auto-create members by email, recompute counters).
- `lib/events.ts` — server helpers: `listEventsTimeline()`, `getEvent(id)`, `listEventAttendance(eventId)`, `listMemberEventHistory(memberUserApiId)`.
- `app/(protected)/events/page.tsx` — server component: vertical timeline.
- `app/(protected)/events/[id]/page.tsx` — server component: single-event detail.
- `app/(protected)/events/[id]/actions.ts` — server action: `updateEventDate(eventId, iso)`.
- `components/events-timeline.tsx` — pure-presentational vertical timeline (newest at top).
- `components/event-date-editor.tsx` — client component: inline edit of `events.event_date`.
- `components/event-attendance-table.tsx` — client component: filterable attendee list.
- `components/charts/approval-pie.tsx` — pie of `invited / approved / declined` for one event.
- `components/charts/registration-vs-checkin.tsx` — two-bar chart `registered` vs `checked_in` for one event.
- `components/charts/attendance-over-time.tsx` — bar/line of `checked_in_count` per event date, newest-right.
- `tests/csv-format.test.ts` — detect() against known Luma header sets and garbage.
- `tests/csv-event-row.test.ts` — parses, enforces email, extracts `evt-XXXXX`, drops unknown custom columns.
- `tests/event-import.test.ts` — idempotency, unknown-email auto-create, counter recompute (pure-unit level against a fake DB shim; see Task 7 for the shim design).
- `tests/csv-multi-file.test.ts` — orchestration-level: one subscribed + two event CSVs in the same batch, mixed success/failure.
- `tests/fixtures/6_event_guests.csv` — synthetic 5-row event-guest CSV for integration-style coverage.

### Modify

- `app/(protected)/import/actions.ts` — accept `File[]`, generate a `batch_id`, dispatch per-file to subscribed vs. event pipelines, return per-file results.
- `app/(protected)/import/page.tsx` — show the multi-file dropzone + per-file result cards with detected-type override.
- `components/csv-dropzone.tsx` — `multiple` file input, per-file status rows, per-file override select.
- `app/(protected)/import/history/page.tsx` — group rows by `batch_id` when present; show the group's detected types.
- `app/(protected)/import/history/[id]/page.tsx` — show event-specific metadata (event name, event id, source_type) when the row came from an event CSV.
- `app/(protected)/members/[id]/page.tsx` — add an Event History section.
- `app/(protected)/analytics/page.tsx` — add an `Attendance over time` Section.
- `lib/analytics.ts` — add an `attendanceOverTime` field with `{ date, label, checkedIn }[]`.
- `components/nav-links.tsx` — flip Events from disabled to real link (remove `disabled: true` and `tag`).
- `lib/types.ts` — add `Event`, `EventAttendance`, `EventWithStats`, and extend `LumaImport` with `source_type`, `luma_event_id`, `luma_event_name`, `batch_id`.
- `README.md` — add the 0004 migration to the Migrations section; add `events` / `event_attendance` to the baseline schema block.

### Not touched

- `auth.ts`, `middleware.ts`, `lib/allowlist.ts`, `lib/supabase-*.ts`, `app/api/**`, `app/(public)/**`, `lib/eboard.ts`, `lib/eboard-db.ts`, `lib/freshness.ts`, `lib/csv-headers.ts`, `lib/csv-row.ts`, `lib/csv-merge.ts` (these keep handling subscribed CSVs as-is), `app/_actions/members.ts`, `app/(protected)/blacklist/actions.ts`.

### Out of scope (followups — documented at the end of this plan, not implemented)

- Custom registration-question import (they vary per event; we only log their header names in `unmapped_headers`).
- A full event-edit UI (only `event_date` is editable in this pass).
- Reconciling subscribed-CSV aggregate counters with event-derived counters. Last-write-wins is the current policy.
- Rekey: if a `source='event_only'` auto-created member later appears in a subscribed CSV, we'd end up with two rows. Flag, report, don't fix now.
- Event deletion UI.
- Cohort/retention charts.
- Bulk recompute CLI for fixing bad imports.

---

## Task 1: Create the worktree

**Files:** none in project; creates an isolated branch.

- [ ] **Step 1: Use the worktree skill**

Invoke `superpowers:using-git-worktrees`. Use `.worktrees/` if it's already the convention; otherwise ask. Branch name: `events-and-multi-csv`.

- [ ] **Step 2: Confirm baseline**

Run: `npm install && npm test`
Expected: every existing test passes. If any fail, stop and report.

- [ ] **Step 3: Report location**

Print the worktree path. All subsequent tasks run from inside it.

---

## Task 2: Migration SQL — do not run yet

**Files:**
- Create: `supabase/migrations/0004_events_and_multi_csv.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0004_events_and_multi_csv.sql
-- Idempotent additive schema for the Events section and multi-format CSV
-- imports. Run manually in Supabase SQL Editor. Safe to re-run.

-- === events ===
create table if not exists events (
  luma_event_id text primary key,
  name text not null,
  event_date timestamptz,
  first_imported_at timestamptz default now(),
  last_imported_at timestamptz default now(),
  registered_count int default 0,
  approved_count int default 0,
  checked_in_count int default 0
);
create index if not exists events_date_idx on events(event_date desc);

-- === event_attendance ===
create table if not exists event_attendance (
  luma_event_id text not null references events(luma_event_id) on delete cascade,
  member_user_api_id text not null references members(user_api_id) on delete cascade,
  guest_api_id text,
  approval_status text check (approval_status in ('invited','approved','declined')),
  registered_at timestamptz,
  checked_in_at timestamptz,
  primary key (luma_event_id, member_user_api_id)
);
create index if not exists event_attendance_member_idx
  on event_attendance(member_user_api_id);
create index if not exists event_attendance_event_idx
  on event_attendance(luma_event_id);

-- === members.source ===
-- 'subscribed' = appeared in a calendar-subscribed CSV at some point
-- 'event_only' = auto-created from an event CSV, never in a subscribed CSV
alter table members add column if not exists source text
  not null default 'subscribed';

-- === luma_imports: record source format + event context + batch ===
alter table luma_imports add column if not exists source_type text;
alter table luma_imports drop constraint if exists luma_imports_source_type_check;
alter table luma_imports add constraint luma_imports_source_type_check
  check (source_type is null or source_type in ('subscribed','event'));
alter table luma_imports add column if not exists luma_event_id text;
alter table luma_imports add column if not exists luma_event_name text;
alter table luma_imports add column if not exists batch_id uuid;
create index if not exists luma_imports_batch_idx on luma_imports(batch_id);
create index if not exists luma_imports_event_idx on luma_imports(luma_event_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0004_events_and_multi_csv.sql
git commit -m "schema: 0004 events + multi-csv migration (not yet applied)"
```

- [ ] **Step 3: Do not apply yet**

The app still runs on the 0002 schema. The migration is applied manually in Supabase SQL Editor by the user after the full plan is implemented and reviewed.

---

## Task 3: `lib/csv-format.ts` — detect the format (TDD)

**Files:**
- Create: `tests/csv-format.test.ts`
- Create: `lib/csv-format.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/csv-format.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- tests/csv-format.test.ts`
Expected: fails to import `../lib/csv-format`.

- [ ] **Step 3: Write the implementation**

Write `lib/csv-format.ts`:

```ts
export type CsvFormat = "subscribed" | "event" | "unknown";

const EVENT_REQUIRED = ["api_id", "approval_status", "qr_code_url"] as const;
const SUBSCRIBED_HINTS = [
  "event_approved_count",
  "event_checked_in_count",
  "events_approved",
  "events_checked_in",
  "approved",
  "rsvps",
  "rsvp_count",
  "checked_in",
  "check_ins",
  "checkins",
  "attended",
  "attendance",
];

function norm(h: string): string {
  return h
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function detectFormat(rawHeaders: string[]): CsvFormat {
  const normed = new Set(rawHeaders.map(norm));
  if (EVENT_REQUIRED.every((h) => normed.has(h))) return "event";
  if (SUBSCRIBED_HINTS.some((h) => normed.has(h))) return "subscribed";
  return "unknown";
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- tests/csv-format.test.ts`
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/csv-format.ts tests/csv-format.test.ts
git commit -m "feat(csv): format detection for subscribed vs event exports"
```

---

## Task 4: `lib/csv-event-row.ts` — parse one event-guest row (TDD)

**Files:**
- Create: `tests/csv-event-row.test.ts`
- Create: `lib/csv-event-row.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/csv-event-row.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- tests/csv-event-row.test.ts`
Expected: fails to import `../lib/csv-event-row`.

- [ ] **Step 3: Write the implementation**

Write `lib/csv-event-row.ts`:

```ts
export type EventAttendanceRow = {
  luma_event_id: string;
  guest_api_id: string | null;
  name: string | null;
  email: string;
  registered_at: string | null;
  checked_in_at: string | null;
  approval_status: "invited" | "approved" | "declined";
};

export type ParseEventRowResult =
  | { ok: true; row: EventAttendanceRow }
  | { ok: false; reason: string; email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVENT_ID_RE = /\/check-in\/(evt-[a-zA-Z0-9]+)/;
const STATUSES = new Set(["invited", "approved", "declined"]);

function cleanStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(/\s+/g, " ");
  return s.length ? s : null;
}

function cleanDate(v: unknown): string | null {
  const s = cleanStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function parseEventRow(
  raw: Record<string, string | undefined>,
): ParseEventRowResult {
  const email = cleanStr(raw.email)?.toLowerCase() ?? null;
  if (!email) return { ok: false, reason: "missing email" };
  if (!EMAIL_RE.test(email)) {
    return { ok: false, reason: `invalid email: ${email}`, email };
  }

  const qr = cleanStr(raw.qr_code_url);
  if (!qr) {
    return { ok: false, reason: "missing qr_code_url", email };
  }
  const m = qr.match(EVENT_ID_RE);
  if (!m) {
    return {
      ok: false,
      reason: `qr_code_url did not contain evt-... id: ${qr}`,
      email,
    };
  }
  const luma_event_id = m[1];

  const statusRaw = cleanStr(raw.approval_status)?.toLowerCase() ?? null;
  if (!statusRaw || !STATUSES.has(statusRaw)) {
    return {
      ok: false,
      reason: `invalid approval_status: ${statusRaw ?? "(blank)"}`,
      email,
    };
  }
  const approval_status = statusRaw as EventAttendanceRow["approval_status"];

  let name = cleanStr(raw.name);
  if (!name) {
    const first = cleanStr(raw.first_name) ?? "";
    const last = cleanStr(raw.last_name) ?? "";
    const synth = `${first} ${last}`.trim();
    name = synth.length ? synth : null;
  }

  return {
    ok: true,
    row: {
      luma_event_id,
      guest_api_id: cleanStr(raw.api_id),
      name,
      email,
      registered_at: cleanDate(raw.created_at),
      checked_in_at: cleanDate(raw.checked_in_at),
      approval_status,
    },
  };
}

// Columns we actively ignore. Everything else (custom questions, unknown
// future Luma additions) also gets dropped but is exposed to the caller so
// it can log them in luma_imports.unmapped_headers.
export const KNOWN_EVENT_HEADERS = new Set<string>([
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
  "amount_tax",
  "amount_discount",
  "currency",
  "coupon_code",
  "eth_address",
  "solana_address",
  "survey_response_rating",
  "survey_response_feedback",
  "ticket_type_id",
  "ticket_name",
]);

export function eventUnmappedHeaders(rawHeaders: string[]): string[] {
  const unmapped: string[] = [];
  for (const h of rawHeaders) {
    const n = h
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (!KNOWN_EVENT_HEADERS.has(n)) unmapped.push(h);
  }
  return unmapped;
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- tests/csv-event-row.test.ts`
Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/csv-event-row.ts tests/csv-event-row.test.ts
git commit -m "feat(csv): per-row parser for Luma event guest exports"
```

---

## Task 5: Extend `lib/types.ts`

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Append new types and extend `LumaImport`**

Open `lib/types.ts`. Replace the `LumaImport` type with:

```ts
export type LumaImport = {
  id: string;
  uploaded_by: string;
  uploaded_at: string;
  storage_path: string;
  row_count: number | null;
  new_count: number | null;
  updated_count: number | null;
  unchanged_count: number | null;
  blocked_count: number | null;
  error_count: number | null;
  status: "success" | "partial" | "failed";
  filename: string | null;
  file_size_bytes: number | null;
  header_mapping: Record<string, string> | null;
  unmapped_headers: string[] | null;
  errors: ImportErrorRow[] | null;
  dry_run: boolean;
  source_type: "subscribed" | "event" | null;
  luma_event_id: string | null;
  luma_event_name: string | null;
  batch_id: string | null;
};
```

Append after the existing types:

```ts
export type Event = {
  luma_event_id: string;
  name: string;
  event_date: string | null;
  first_imported_at: string;
  last_imported_at: string;
  registered_count: number;
  approved_count: number;
  checked_in_count: number;
};

export type EventAttendance = {
  luma_event_id: string;
  member_user_api_id: string;
  guest_api_id: string | null;
  approval_status: "invited" | "approved" | "declined";
  registered_at: string | null;
  checked_in_at: string | null;
};

export type EventAttendanceWithMember = EventAttendance & {
  member: Pick<
    Member,
    "user_api_id" | "name" | "email" | "major" | "grad_year"
  >;
};
```

Also extend `Member` to include the new `source` column. Find `export type Member = {` and add `source: "subscribed" | "event_only";` after `hidden: boolean;`.

- [ ] **Step 2: Typecheck**

Run: `npm run build 2>&1 | tail -20`
Expected: succeeds. If errors reference callers we don't intend to change, fix those in-place rather than reverting types.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "types: add Event, EventAttendance; extend LumaImport + Member"
```

---

## Task 6: `lib/event-import.ts` — orchestrate one event CSV

**Files:**
- Create: `lib/event-import.ts`

This task is implementation-only (integration-style behavior is covered by the DB-shim test in Task 7). It follows the spec verbatim: upsert the event row → delete attendance for that event → look up members by normalized email → auto-create missing members → insert new attendance → recompute member counters.

- [ ] **Step 1: Write the module**

Write `lib/event-import.ts`:

```ts
import "server-only";
import { supabaseServer } from "./supabase-server";
import type { EventAttendanceRow } from "./csv-event-row";

export type EventImportResult = {
  luma_event_id: string;
  event_name: string;
  event_date: string | null;
  was_replacing: boolean;
  registered: number;
  approved: number;
  checked_in: number;
  auto_created_members: number;
  touched_members: number;
  blocked_count: number;
};

function deriveEventDate(rows: EventAttendanceRow[]): string | null {
  let maxCheckin: string | null = null;
  for (const r of rows) {
    if (r.checked_in_at && (!maxCheckin || r.checked_in_at > maxCheckin)) {
      maxCheckin = r.checked_in_at;
    }
  }
  if (maxCheckin) return maxCheckin;
  let maxRegistered: string | null = null;
  for (const r of rows) {
    if (r.registered_at && (!maxRegistered || r.registered_at > maxRegistered)) {
      maxRegistered = r.registered_at;
    }
  }
  return maxRegistered;
}

function eventNameFromFilename(filename: string | null): string {
  if (!filename) return "Untitled event";
  const base = filename.replace(/\.csv$/i, "").trim();
  return base.length ? base : "Untitled event";
}

export async function importEvent(args: {
  rows: EventAttendanceRow[];
  filename: string | null;
  blockedEmails: Set<string>;
}): Promise<EventImportResult> {
  const { rows: allRows, filename, blockedEmails } = args;
  if (allRows.length === 0) throw new Error("importEvent: no rows to import");

  // All rows must share the same luma_event_id by construction (parser
  // extracts from qr_code_url, and the UI/server won't mix files).
  const luma_event_id = allRows[0].luma_event_id;
  for (const r of allRows) {
    if (r.luma_event_id !== luma_event_id) {
      throw new Error(
        `event CSV rows span multiple events: ${luma_event_id} vs ${r.luma_event_id}`,
      );
    }
  }

  // Filter blocked emails BEFORE auto-create and BEFORE attendance insert.
  // Blocked guests don't become members, don't appear in event_attendance,
  // and aren't counted in events.registered_count / approved_count /
  // checked_in_count — as if they weren't in the CSV at all.
  const rows = allRows.filter((r) => !blockedEmails.has(r.email));
  const blocked_count = allRows.length - rows.length;

  // 1. Is this event already in the DB? (So the UI can show "replacing".)
  const { data: existingEvent, error: evErr } = await supabaseServer
    .from("events")
    .select("luma_event_id, name, event_date, first_imported_at")
    .eq("luma_event_id", luma_event_id)
    .maybeSingle();
  if (evErr) throw new Error(`event lookup failed: ${evErr.message}`);
  const wasReplacing = !!existingEvent;

  // 2. Match incoming emails against existing members.
  const emails = Array.from(new Set(rows.map((r) => r.email)));
  const memberByEmail = new Map<string, string>(); // email -> user_api_id
  const CHUNK = 200;
  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK);
    const { data, error } = await supabaseServer
      .from("members")
      .select("user_api_id, email_normalized")
      .in("email_normalized", chunk);
    if (error) throw new Error(`member lookup failed: ${error.message}`);
    for (const m of data ?? []) {
      const em = (m as { email_normalized: string }).email_normalized;
      const id = (m as { user_api_id: string }).user_api_id;
      if (em) memberByEmail.set(em, id);
    }
  }

  // 3. Auto-create members for emails we've never seen.
  const toCreate: {
    user_api_id: string;
    name: string | null;
    email: string;
    first_seen: string | null;
    source: "event_only";
  }[] = [];
  for (const r of rows) {
    if (memberByEmail.has(r.email)) continue;
    if (!r.guest_api_id) continue; // defensive; parser sets it from api_id
    const existingGuestIdAsMember = toCreate.find(
      (x) => x.user_api_id === r.guest_api_id,
    );
    if (existingGuestIdAsMember) continue;
    toCreate.push({
      user_api_id: r.guest_api_id,
      name: r.name,
      email: r.email,
      first_seen: r.registered_at,
      source: "event_only",
    });
  }
  if (toCreate.length > 0) {
    const { error: insErr } = await supabaseServer
      .from("members")
      .upsert(toCreate, { onConflict: "user_api_id" });
    if (insErr) throw new Error(`auto-create members failed: ${insErr.message}`);
    for (const c of toCreate) memberByEmail.set(c.email, c.user_api_id);
  }

  // 4. Upsert the event row. Derive event_date from rows; do NOT clobber a
  //    human-edited event_date on re-import (only set on first import).
  const derivedDate = deriveEventDate(rows);
  const eventName = existingEvent?.name ?? eventNameFromFilename(filename);
  const registered = rows.filter((r) => r.approval_status !== "declined").length;
  const approved = rows.filter((r) => r.approval_status === "approved").length;
  const checkedIn = rows.filter((r) => r.checked_in_at !== null).length;

  const eventUpsert: Record<string, unknown> = {
    luma_event_id,
    name: eventName,
    last_imported_at: new Date().toISOString(),
    registered_count: registered,
    approved_count: approved,
    checked_in_count: checkedIn,
  };
  if (!existingEvent) {
    eventUpsert.event_date = derivedDate;
    eventUpsert.first_imported_at = new Date().toISOString();
  } else if (existingEvent.event_date === null) {
    // Only fill event_date from rows if nobody has set it yet.
    eventUpsert.event_date = derivedDate;
  }

  const { error: upEvErr } = await supabaseServer
    .from("events")
    .upsert(eventUpsert, { onConflict: "luma_event_id" });
  if (upEvErr) throw new Error(`event upsert failed: ${upEvErr.message}`);

  // 5. Delete existing attendance for this event, then insert fresh.
  const { error: delErr } = await supabaseServer
    .from("event_attendance")
    .delete()
    .eq("luma_event_id", luma_event_id);
  if (delErr) throw new Error(`attendance clear failed: ${delErr.message}`);

  // Deduplicate by (event, member) — take the row with the latest
  // checked_in_at, otherwise the latest registered_at, otherwise arbitrary.
  // This guards against multi-ticket members in the same event.
  type Attn = {
    luma_event_id: string;
    member_user_api_id: string;
    guest_api_id: string | null;
    approval_status: EventAttendanceRow["approval_status"];
    registered_at: string | null;
    checked_in_at: string | null;
  };
  const byMember = new Map<string, Attn>();
  for (const r of rows) {
    const memberId = memberByEmail.get(r.email);
    if (!memberId) continue; // should be unreachable (we just created them)
    const prev = byMember.get(memberId);
    const candidate: Attn = {
      luma_event_id,
      member_user_api_id: memberId,
      guest_api_id: r.guest_api_id,
      approval_status: r.approval_status,
      registered_at: r.registered_at,
      checked_in_at: r.checked_in_at,
    };
    if (!prev) {
      byMember.set(memberId, candidate);
      continue;
    }
    const prevScore =
      (prev.checked_in_at ? 2 : 0) + (prev.registered_at ? 1 : 0);
    const nextScore =
      (candidate.checked_in_at ? 2 : 0) + (candidate.registered_at ? 1 : 0);
    if (nextScore > prevScore) byMember.set(memberId, candidate);
  }
  const attnRows = Array.from(byMember.values());

  if (attnRows.length > 0) {
    for (let i = 0; i < attnRows.length; i += 500) {
      const chunk = attnRows.slice(i, i + 500);
      const { error: insAttnErr } = await supabaseServer
        .from("event_attendance")
        .insert(chunk);
      if (insAttnErr) {
        throw new Error(`attendance insert failed: ${insAttnErr.message}`);
      }
    }
  }

  // 6. Recompute members.event_approved_count and event_checked_in_count for
  //    every member we just touched. One UPDATE per column against a
  //    grouped subquery.
  const touched = Array.from(byMember.keys());
  await recomputeMemberCounters(touched);

  return {
    luma_event_id,
    event_name: eventName,
    event_date: derivedDate,
    was_replacing: wasReplacing,
    registered,
    approved,
    checked_in: checkedIn,
    auto_created_members: toCreate.length,
    touched_members: touched.length,
    blocked_count,
  };
}

export async function recomputeMemberCounters(
  memberIds: string[],
): Promise<void> {
  if (memberIds.length === 0) return;
  // Pull aggregates from event_attendance, then patch members row-by-row
  // in chunks. Supabase JS doesn't expose a raw UPDATE FROM (SELECT…) so
  // we do it client-side. One query per chunk, not one per member.
  const CHUNK = 200;
  for (let i = 0; i < memberIds.length; i += CHUNK) {
    const chunk = memberIds.slice(i, i + CHUNK);
    const { data, error } = await supabaseServer
      .from("event_attendance")
      .select("member_user_api_id, approval_status, checked_in_at")
      .in("member_user_api_id", chunk);
    if (error) {
      throw new Error(`counter recompute read failed: ${error.message}`);
    }
    const counts = new Map<
      string,
      { approved: number; checked_in: number }
    >();
    for (const id of chunk) counts.set(id, { approved: 0, checked_in: 0 });
    for (const r of data ?? []) {
      const rec = r as {
        member_user_api_id: string;
        approval_status: EventAttendanceRow["approval_status"];
        checked_in_at: string | null;
      };
      const acc = counts.get(rec.member_user_api_id);
      if (!acc) continue;
      if (rec.approval_status === "approved") acc.approved++;
      if (rec.checked_in_at) acc.checked_in++;
    }
    // Write them back. supabase-js doesn't support bulk UPDATE with
    // different values per row, so we issue one UPDATE per member in the
    // chunk. Chunks are bounded by 200 → at most 17 × 419 touches in the
    // largest realistic batch; well within request budgets.
    for (const [id, c] of counts) {
      const { error: upErr } = await supabaseServer
        .from("members")
        .update({
          event_approved_count: c.approved,
          event_checked_in_count: c.checked_in,
        })
        .eq("user_api_id", id);
      if (upErr) {
        throw new Error(`counter recompute write failed: ${upErr.message}`);
      }
    }
  }
}
```

**Known limits of this recompute strategy.** The bound is members-touched-per-import × 2 round-trips (read-aggregate + per-member-update). For the largest realistic import (~419 guests, one event) that is ~840 DB calls, completing well under the server action's time budget. If a single import ever touches more than ~2000 distinct member rows, reconsider switching to a Postgres RPC that runs `UPDATE members … FROM (SELECT member_user_api_id, count(*) filter (where approval_status='approved') … FROM event_attendance GROUP BY …)` in one statement.

- [ ] **Step 2: Typecheck**

Run: `npm run build 2>&1 | tail -40`
Expected: succeeds. `event-import.ts` has no callers yet — any failures will be from type mismatches inside the module itself.

- [ ] **Step 3: Commit**

```bash
git add lib/event-import.ts
git commit -m "feat(events): importEvent orchestration + counter recompute"
```

---

## Task 7: `tests/event-import.test.ts` — orchestration test against a fake DB

**Files:**
- Create: `tests/event-import.test.ts`

The real `importEvent` talks to Supabase. To test it as a pure unit we inject a `DbShim` that mirrors the table subset we touch. The shim implements the same `.from().select().eq()`-style chain the code uses. This is a one-off: we do NOT introduce a DI pattern across the codebase.

- [ ] **Step 1: Refactor `importEvent` to accept an optional DB injection**

Add at the top of `lib/event-import.ts`, above `importEvent`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type ImportEventDeps = {
  db: Pick<SupabaseClient, "from">;
};
```

Change `importEvent` and `recomputeMemberCounters` to accept an optional `deps?: ImportEventDeps` last argument. When absent, use `supabaseServer`. All calls inside should use `(deps?.db ?? supabaseServer).from(…)`.

This is the only intrusive change for testability. The server action (Task 8) uses the default branch and passes no deps.

- [ ] **Step 2: Write the failing tests**

Write `tests/event-import.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests — expect failure, then pass**

Run: `npm test -- tests/event-import.test.ts`
Expected: initially fails with import errors until Task 7 Step 1 is done. After Step 1, all 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/event-import.ts tests/event-import.test.ts
git commit -m "test(events): orchestration tests with in-memory db shim"
```

---

## Task 8: Multi-file import server action

**Files:**
- Modify: `app/(protected)/import/actions.ts`

Goal: the server action should accept `FormData` with one or more files keyed `file` (repeated), plus a per-file `override_N` field (`"auto" | "subscribed" | "event"`). Generate one `batch_id`, process each file independently, return per-file results. A failing file logs a `luma_imports` row with `status='failed'` and continues; it does not abort the batch.

- [ ] **Step 1: Extract the existing subscribed-CSV pipeline into a helper**

Refactor `actions.ts`: move the parse → map → classify → upsert → patch logic into `async function runSubscribedImport(args: { buffer, text, filename, fileSize, editor, dryRun, batchId }): Promise<PerFileResult>` that returns the same shape the UI expects, but with no side-effects beyond `luma_imports` / `members` / `member_edits` writes. Keep the existing storage-upload + `luma_imports` insert inside this helper. Stamp `source_type='subscribed'` and `batch_id` onto the `luma_imports` insert.

- [ ] **Step 2: Write the event-CSV helper**

Add `async function runEventImport(args): Promise<PerFileResult>`:
- Accept `blockedEmails: Set<string>` (loaded once per batch; see Step 3) in its args.
- Parse headers with papaparse, compute `unmapped = eventUnmappedHeaders(headers)`.
- For each data row, call `parseEventRow(raw)`; push `{row, reason, email}` errors into an array; collect good rows.
- If no good rows: create a failed `luma_imports` row, return error result.
- Derive `luma_event_id` from the first good row; reject mixed-event files with a per-file error.
- Upload the raw CSV to storage (skip on dry-run).
- Insert a `luma_imports` row with `source_type='event'`, `luma_event_id`, `batch_id`, `header_mapping={}`, `unmapped_headers=unmapped`.
- Call `importEvent({ rows, filename, blockedEmails })` inside a try/catch.
- Patch the `luma_imports` row with `new_count`/`updated_count`/`unchanged_count`/`blocked_count`/`error_count`/`status`/`luma_event_name` + `errors`.
  - `new_count` = `auto_created_members`; `updated_count` = `touched_members - auto_created_members`; `unchanged_count` = 0 (the event CSV always writes a fresh attendance row); `blocked_count` = `result.blocked_count` from `importEvent`.

- [ ] **Step 3: Rewrite the exported action**

Replace the top-level `importCsv` signature with:

```ts
export type PerFileResult =
  | ({
      ok: true;
      filename: string;
      source_type: "subscribed" | "event";
      luma_event_id?: string;
      luma_event_name?: string;
      replacing?: boolean;
    } & BaseOkFields)
  | { ok: false; filename: string; message: string };

export type ImportBatchResult = {
  batch_id: string;
  files: PerFileResult[];
};

export async function importCsvBatch(
  formData: FormData,
  dryRun: boolean = false,
): Promise<ImportBatchResult> {
  const editor = await requireEditorEmail();
  const batchId = crypto.randomUUID();
  const files = formData.getAll("file").filter((f): f is File => f instanceof File);
  const overrides = files.map((_, i) => String(formData.get(`override_${i}`) ?? "auto"));
  // …validate file sizes & .csv extension up-front; collect per-file errors…
  const results: PerFileResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // …size checks, read buffer, papaparse headers only to decide format…
    const override = overrides[i];
    const text = await readFile(file);
    const headers = parseHeadersOnly(text);
    const detected = detectFormat(headers);
    const chosen =
      override === "subscribed" || override === "event" ? override : detected;
    try {
      if (chosen === "event") {
        results.push(await runEventImport({ …, batchId, editor, dryRun }));
      } else if (chosen === "subscribed") {
        results.push(await runSubscribedImport({ …, batchId, editor, dryRun }));
      } else {
        results.push({
          ok: false,
          filename: file.name,
          message:
            "Could not detect CSV format. Expected Luma calendar-subscribed or event guest export.",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ ok: false, filename: file.name, message: msg });
    }
  }
  revalidatePath("/");
  revalidatePath("/analytics");
  revalidatePath("/events");
  revalidatePath("/import");
  revalidatePath("/import/history");
  return { batch_id: batchId, files: results };
}

// Kept for call-sites that still pass a single file. Thin wrapper.
export async function importCsv(
  formData: FormData,
  dryRun: boolean = false,
): Promise<PerFileResult> {
  const batch = await importCsvBatch(formData, dryRun);
  return batch.files[0];
}
```

Implement `readFile` (arrayBuffer → utf-8, strip BOM), `parseHeadersOnly` (papaparse with `preview: 1`, return `meta.fields`). Reuse the existing `MAX_BYTES` + `.csv` extension guards per-file.

**Load the blacklist once per batch.** Move the `supabaseServer.from("blacklist").select("email_normalized")` read out of `runSubscribedImport` and up into `importCsvBatch`, before the per-file loop. Pass the resulting `Set<string>` into both `runSubscribedImport` and `runEventImport`. Both helpers apply the same `email_normalized` filter so a member blocked in `blacklist` is treated identically across both CSV formats: they don't get auto-created, don't get `event_attendance` rows, and count toward `luma_imports.blocked_count`. Event stats (`events.registered_count` / `approved_count` / `checked_in_count`) are computed from the post-filter rows, so blocked attendees are absent from event statistics as well.

- [ ] **Step 4: Typecheck + commit**

Run: `npm run build 2>&1 | tail -40`
Expected: succeeds, though the current `CsvDropzone` will still call `importCsv` with one file which the shim preserves. The UI is rewritten in Task 10.

```bash
git add app/(protected)/import/actions.ts
git commit -m "feat(import): multi-file batch action + event-CSV dispatch"
```

---

## Task 9: `tests/csv-multi-file.test.ts` — orchestration sanity

**Files:**
- Create: `tests/csv-multi-file.test.ts`
- Create: `tests/fixtures/6_event_guests.csv`

Because the full `importCsvBatch` touches storage + DB, the test exercises a *pure* slice: the detection + dispatch loop. Extract the loop into a small function that takes a `handlers: { subscribed: (…) => PerFileResult; event: (…) => PerFileResult }` parameter; the real server action wires this to `runSubscribedImport` / `runEventImport`, the test wires it to stubs.

- [ ] **Step 1: Extract the dispatch loop**

In `app/(protected)/import/actions.ts`, refactor `importCsvBatch` so the per-file body that decides format and calls the right handler is exported as:

```ts
export type DispatchHandlers = {
  subscribed: (args: DispatchArgs) => Promise<PerFileResult>;
  event: (args: DispatchArgs) => Promise<PerFileResult>;
};

export type DispatchArgs = {
  filename: string;
  text: string;
  override: "auto" | "subscribed" | "event";
  dryRun: boolean;
  batchId: string;
  editor: string;
};

export async function dispatchOne(
  args: DispatchArgs,
  handlers: DispatchHandlers,
): Promise<PerFileResult> { … }
```

- [ ] **Step 2: Write the fixture**

Create `tests/fixtures/6_event_guests.csv` (5 rows; names + emails + approval_status + created_at + checked_in_at + qr_code_url — one row missing email to exercise the error path).

- [ ] **Step 3: Write the tests**

```ts
import { describe, it, expect, vi } from "vitest";
import { dispatchOne } from "../app/(protected)/import/actions";

const eventCsv = /* inlined fixture text via fs.readFileSync */;
const subscribedCsv = /* tests/fixtures/1_base.csv */;

describe("dispatchOne", () => {
  it("routes event CSVs to the event handler", async () => {
    const event = vi.fn(async () => ({ ok: true, /* … */ } as any));
    const subscribed = vi.fn(async () => ({ ok: true } as any));
    await dispatchOne(
      { filename: "a.csv", text: eventCsv, override: "auto", /* … */ },
      { event, subscribed },
    );
    expect(event).toHaveBeenCalled();
    expect(subscribed).not.toHaveBeenCalled();
  });

  it("honors an explicit override", async () => {
    const event = vi.fn(async () => ({ ok: true } as any));
    const subscribed = vi.fn(async () => ({ ok: true } as any));
    await dispatchOne(
      { filename: "a.csv", text: eventCsv, override: "subscribed", /* … */ },
      { event, subscribed },
    );
    expect(subscribed).toHaveBeenCalled();
    expect(event).not.toHaveBeenCalled();
  });

  it("returns the unknown-format error for garbage headers", async () => {
    const res = await dispatchOne(
      { filename: "a.csv", text: "foo,bar\n1,2\n", override: "auto", /* … */ },
      { event: vi.fn(), subscribed: vi.fn() },
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).toMatch(/Could not detect/);
  });
});
```

- [ ] **Step 4: Run + commit**

Run: `npm test -- tests/csv-multi-file.test.ts`
Expected: all 3 tests pass.

```bash
git add tests/csv-multi-file.test.ts tests/fixtures/6_event_guests.csv app/(protected)/import/actions.ts
git commit -m "test(import): dispatch loop + event-format fixture"
```

---

## Task 10: Multi-file dropzone UI

**Files:**
- Modify: `components/csv-dropzone.tsx`
- Modify: `app/(protected)/import/page.tsx`

- [ ] **Step 1: Accept multiple files**

In `components/csv-dropzone.tsx`, replace the single-file `File | null` state with `File[]`. Add `multiple` to the `<input type="file">`. When a drop event fires with multiple files, append all `.csv` files; non-CSV files get recorded as a per-file error.

- [ ] **Step 2: Per-file format detection in the browser**

Read the first line of each file to compute a preview header list (using `file.slice(0, 4096).text()` + newline split). Compute `detectFormat(headers)` and keep it as `files: { file, detected, override }[]`. Show each row as:

```
filename.csv               12.4 KB        [ detected: event  ▼ ]   [ × ]
```

The `▼` is a `<select>` with options `Auto (event)`, `Subscribed`, `Event`. Default is `auto`.

- [ ] **Step 3: Submit the batch**

On Upload, construct `FormData` with multiple `file` entries + matching `override_N` entries. Call `importCsvBatch` (new server action). Replace the single `ResultPanel` with a `BatchResultPanel` that renders one card per file, each card showing the status, detected/overridden type, counts chip row, and a `View details →` link to `/import/history/<import_id>`.

Code sketch:

```tsx
function BatchResultPanel({ batch }: { batch: ImportBatchResult }) {
  return (
    <div className="space-y-3">
      {batch.files.map((r, i) => (
        <PerFileCard key={i} result={r} />
      ))}
    </div>
  );
}

function PerFileCard({ result }: { result: PerFileResult }) {
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {result.filename}
        </p>
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">
          {result.message}
        </p>
      </div>
    );
  }
  const tone = result.error_count > 0 ? "amber" : "green";
  return (
    <div className={`space-y-3 rounded-lg border p-4 ${/* tone styles */}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{result.filename}</p>
          <p className="mt-0.5 text-xs uppercase tracking-wider text-zinc-500">
            {result.source_type}
            {result.luma_event_name && ` · ${result.luma_event_name}`}
            {result.replacing && " · replacing previous import"}
          </p>
        </div>
        <Link href={`/import/history/${result.import_id}`}>View details →</Link>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {result.source_type === "subscribed" && (
          <>
            <Chip tone="green">{result.new_count} new</Chip>
            <Chip tone="violet">{result.updated_count} updated</Chip>
            <Chip tone="zinc">{result.unchanged_count} unchanged</Chip>
            <Chip tone="zinc">{result.blocked_count} blocked</Chip>
          </>
        )}
        {result.source_type === "event" && (
          <>
            <Chip tone="green">{result.new_count} new members</Chip>
            <Chip tone="violet">{result.updated_count} updated members</Chip>
            <Chip tone="zinc">{result.blocked_count} blocked</Chip>
            <Chip tone="zinc">
              {result.registered_count ?? 0} registered · {result.checked_in_count ?? 0} checked in
            </Chip>
          </>
        )}
        <Chip tone={result.error_count ? "amber" : "zinc"}>
          {result.error_count} errors
        </Chip>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update the page copy**

In `app/(protected)/import/page.tsx`, update the description to "Upload one or more Luma CSVs. Calendar-subscribed and per-event guest exports are both supported — drop them in together and we'll route each one." Keep the "Last import" block as-is.

- [ ] **Step 5: Manually verify**

Run `npm run dev`. Navigate to `/import`. Drag-drop `tests/fixtures/1_base.csv` and `tests/fixtures/6_event_guests.csv` together. Confirm:
- Both filenames appear with detected types ("subscribed", "event").
- The override dropdown switches cleanly.
- Upload (without dry-run requires the migration; for now test with dry-run) returns a card per file.

- [ ] **Step 6: Commit**

```bash
git add components/csv-dropzone.tsx app/(protected)/import/page.tsx
git commit -m "feat(import): multi-file dropzone with per-file detection + override"
```

---

## Task 11: Un-disable Events nav

**Files:**
- Modify: `components/nav-links.tsx`

- [ ] **Step 1: Remove the disabled flag**

In `components/nav-links.tsx`, replace:

```ts
{ href: "/events", label: "Events", disabled: true, tag: "in the works" },
```

with:

```ts
{ href: "/events", label: "Events" },
```

- [ ] **Step 2: Smoke test**

`npm run dev`, navigate any protected page, confirm Events is a link and becomes active on `/events`.

- [ ] **Step 3: Commit**

```bash
git add components/nav-links.tsx
git commit -m "nav: activate Events link"
```

---

## Task 12: `lib/events.ts` — server helpers for reads

**Files:**
- Create: `lib/events.ts`

- [ ] **Step 1: Write the helpers**

```ts
import "server-only";
import { supabaseServer } from "./supabase-server";
import type {
  Event,
  EventAttendance,
  EventAttendanceWithMember,
  Member,
} from "./types";

export async function listEventsTimeline(): Promise<Event[]> {
  const { data, error } = await supabaseServer
    .from("events")
    .select("*")
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("first_imported_at", { ascending: false });
  if (error) throw new Error(`Failed to list events: ${error.message}`);
  return (data as Event[]) ?? [];
}

export async function getEvent(lumaEventId: string): Promise<Event | null> {
  const { data, error } = await supabaseServer
    .from("events")
    .select("*")
    .eq("luma_event_id", lumaEventId)
    .maybeSingle();
  if (error) throw new Error(`Failed to get event: ${error.message}`);
  return (data as Event) ?? null;
}

export async function listEventAttendance(
  lumaEventId: string,
): Promise<EventAttendanceWithMember[]> {
  const { data: attendance, error: aErr } = await supabaseServer
    .from("event_attendance")
    .select("*")
    .eq("luma_event_id", lumaEventId);
  if (aErr) throw new Error(`Failed to list attendance: ${aErr.message}`);
  const rows = (attendance as EventAttendance[]) ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.member_user_api_id);
  const { data: members, error: mErr } = await supabaseServer
    .from("members")
    .select("user_api_id, name, email, major, grad_year")
    .in("user_api_id", ids);
  if (mErr) throw new Error(`Failed to load members: ${mErr.message}`);
  const byId = new Map<string, Pick<Member, "user_api_id" | "name" | "email" | "major" | "grad_year">>();
  for (const m of members ?? []) {
    byId.set((m as { user_api_id: string }).user_api_id, m as any);
  }
  return rows.map((r) => ({
    ...r,
    member: byId.get(r.member_user_api_id) ?? {
      user_api_id: r.member_user_api_id,
      name: null,
      email: null,
      major: null,
      grad_year: null,
    },
  }));
}

export async function listMemberEventHistory(
  memberUserApiId: string,
): Promise<
  Array<{
    luma_event_id: string;
    name: string;
    event_date: string | null;
    approval_status: EventAttendance["approval_status"];
    checked_in_at: string | null;
  }>
> {
  const { data, error } = await supabaseServer
    .from("event_attendance")
    .select(
      "luma_event_id, approval_status, checked_in_at, events(name, event_date)",
    )
    .eq("member_user_api_id", memberUserApiId)
    .order("events(event_date)", { ascending: false });
  if (error) {
    throw new Error(`Failed to list member event history: ${error.message}`);
  }
  return (data ?? []).map((r: any) => ({
    luma_event_id: r.luma_event_id,
    name: r.events?.name ?? "Untitled event",
    event_date: r.events?.event_date ?? null,
    approval_status: r.approval_status,
    checked_in_at: r.checked_in_at,
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/events.ts
git commit -m "feat(events): server read helpers"
```

---

## Task 13: `/events` — timeline page + component

**Files:**
- Create: `app/(protected)/events/page.tsx`
- Create: `components/events-timeline.tsx`

**Design direction (frontend-design skill):** refined-editorial, not maximalist. The app's existing vocabulary is zinc/violet, uppercase section labels with wide tracking, font-display serif for H1s, sharp borders with 2px active underlines. The timeline should feel like a magazine's event archive: a single violet hairline spine running down the left edge, each event is a flush-left card that overlaps the spine with a 9px violet dot, date above the event name in the tiny uppercase label style, counts in tabular-nums, a thin gap between cards. No excessive animation — one staggered fade-in on first paint (CSS `animation-delay: calc(var(--i) * 40ms)`).

- [ ] **Step 1: Write the page**

```tsx
// app/(protected)/events/page.tsx
import Link from "next/link";
import { listEventsTimeline } from "@/lib/events";
import { EventsTimeline } from "@/components/events-timeline";

export default async function EventsPage() {
  const events = await listEventsTimeline();
  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Programming
          </span>
          <h1 className="mt-1 font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900 dark:text-zinc-50">
            Events
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Every Luma event we have guest data for. Newest at the top.
            Import an event&rsquo;s guest CSV on the{" "}
            <Link href="/import" className="underline decoration-violet-500/40 underline-offset-4 hover:decoration-violet-500">
              Import page
            </Link>
            .
          </p>
        </div>
      </div>
      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          No events yet. Drop a per-event guest CSV into{" "}
          <Link href="/import" className="text-violet-600 hover:text-violet-700">
            /import
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <EventsTimeline events={events} />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Write the timeline component**

```tsx
// components/events-timeline.tsx
import Link from "next/link";
import type { Event } from "@/lib/types";
import { formatDate } from "@/lib/format";

function showRate(e: Event): string {
  if (!e.approved_count) return "—";
  return `${Math.round((e.checked_in_count / e.approved_count) * 100)}%`;
}

export function EventsTimeline({ events }: { events: Event[] }) {
  return (
    <ol className="relative ml-3 border-l border-violet-500/30 dark:border-violet-400/30">
      {events.map((e, i) => (
        <li
          key={e.luma_event_id}
          className="relative mb-6 pl-8"
          style={{ ["--i" as any]: i }}
        >
          <span
            aria-hidden
            className="absolute -left-[5px] top-4 h-[10px] w-[10px] rounded-full bg-violet-500 ring-4 ring-white dark:ring-zinc-950"
          />
          <Link
            href={`/events/${encodeURIComponent(e.luma_event_id)}`}
            className="group block rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-violet-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-600"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  {formatDate(e.event_date)}
                </p>
                <h3 className="mt-1 font-display text-[20px] leading-tight text-zinc-900 group-hover:text-violet-700 dark:text-zinc-50 dark:group-hover:text-violet-300">
                  {e.name}
                </h3>
              </div>
              <dl className="flex gap-5 text-right font-mono tabular-nums">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Registered
                  </dt>
                  <dd className="text-sm text-zinc-900 dark:text-zinc-50">
                    {e.registered_count}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Approved
                  </dt>
                  <dd className="text-sm text-zinc-900 dark:text-zinc-50">
                    {e.approved_count}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Checked in
                  </dt>
                  <dd className="text-sm text-zinc-900 dark:text-zinc-50">
                    {e.checked_in_count}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Show
                  </dt>
                  <dd className="text-sm text-violet-700 dark:text-violet-300">
                    {showRate(e)}
                  </dd>
                </div>
              </dl>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(protected)/events/page.tsx components/events-timeline.tsx
git commit -m "feat(events): /events vertical timeline"
```

---

## Task 14: Event charts

**Files:**
- Create: `components/charts/approval-pie.tsx`
- Create: `components/charts/registration-vs-checkin.tsx`

- [ ] **Step 1: Approval breakdown pie**

```tsx
"use client";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useChartTheme } from "./use-chart-theme";

export function ApprovalPie({
  data,
}: {
  data: { invited: number; approved: number; declined: number };
}) {
  const t = useChartTheme();
  const rows = [
    { name: "Approved", value: data.approved },
    { name: "Invited", value: data.invited },
    { name: "Declined", value: data.declined },
  ];
  const colors = [t.accent, t.accentSoft, "rgba(228, 228, 231, 0.7)"];
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={80}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={colors[i]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: t.tooltipBg,
              border: "none",
              borderRadius: 4,
              color: t.tooltipText,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: t.tick }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Registered vs checked-in bar**

```tsx
"use client";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartTheme } from "./use-chart-theme";

export function RegistrationVsCheckin({
  data,
}: {
  data: { registered: number; checked_in: number };
}) {
  const t = useChartTheme();
  const rows = [
    { label: "Registered", count: data.registered },
    { label: "Checked in", count: data.checked_in },
  ];
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={t.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            stroke={t.axis}
            tick={{ fill: t.tick, fontSize: 11 }}
          />
          <YAxis stroke={t.axis} tick={{ fill: t.tick, fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: t.tooltipBg,
              border: "none",
              borderRadius: 4,
              color: t.tooltipText,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill={t.accent} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/charts/approval-pie.tsx components/charts/registration-vs-checkin.tsx
git commit -m "feat(charts): per-event approval pie + registration/checkin bar"
```

---

## Task 15: Event attendance table

**Files:**
- Create: `components/event-attendance-table.tsx`

- [ ] **Step 1: Write the component**

The spec calls for showing *only* member-table columns + attendance facts. Default visible: name, email, grad_year, major, approval_status, checked_in (Yes/No). Hidden by default: pronouns, gender, linkedin_url, custom_tags, the aggregate counters.

For this pass we show only the default columns — no column-picker UI. A per-row link goes to `/members/<user_api_id>`.

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { EventAttendanceWithMember } from "@/lib/types";
import { Chip } from "@/components/ui/chip";

type Filter = "all" | "approved" | "checked_in" | "no_show";

export function EventAttendanceTable({
  rows,
}: {
  rows: EventAttendanceWithMember[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "approved" && r.approval_status !== "approved") return false;
      if (filter === "checked_in" && !r.checked_in_at) return false;
      if (filter === "no_show") {
        if (r.approval_status !== "approved" || r.checked_in_at) return false;
      }
      if (!q) return true;
      const hay = `${r.member.name ?? ""} ${r.member.email ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter, query]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Attendees ({filtered.length})
        </h2>
        <div className="flex items-center gap-2">
          <input
            placeholder="Search name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="checked_in">Checked in</option>
            <option value="no_show">No-shows</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Grad year</th>
              <th className="p-3 font-medium">Major</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Checked in</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.member_user_api_id}
                className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-950"
              >
                <td className="p-3">
                  <Link
                    href={`/members/${encodeURIComponent(r.member_user_api_id)}`}
                    className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                  >
                    {r.member.name ?? "—"}
                  </Link>
                </td>
                <td className="p-3 font-mono text-xs">{r.member.email ?? "—"}</td>
                <td className="p-3">{r.member.grad_year ?? "—"}</td>
                <td className="p-3">{r.member.major ?? "—"}</td>
                <td className="p-3">
                  <Chip
                    tone={
                      r.approval_status === "approved"
                        ? "green"
                        : r.approval_status === "declined"
                          ? "red"
                          : "zinc"
                    }
                  >
                    {r.approval_status}
                  </Chip>
                </td>
                <td className="p-3">{r.checked_in_at ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/event-attendance-table.tsx
git commit -m "feat(events): filterable attendee table"
```

---

## Task 16: `/events/[id]` page + date override

**Files:**
- Create: `app/(protected)/events/[id]/page.tsx`
- Create: `app/(protected)/events/[id]/actions.ts`
- Create: `components/event-date-editor.tsx`

- [ ] **Step 1: Write the server action**

```ts
// app/(protected)/events/[id]/actions.ts
"use server";

import { auth } from "@/auth";
import { isAllowed } from "@/lib/allowlist";
import { supabaseServer } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function updateEventDate(
  lumaEventId: string,
  iso: string | null,
): Promise<void> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email || !isAllowed(email, process.env.ALLOWED_EMAILS)) {
    throw new Error("Not authorized");
  }
  let value: string | null = null;
  if (iso && iso.trim()) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) {
      throw new Error("Invalid date");
    }
    value = d.toISOString();
  }
  const { error } = await supabaseServer
    .from("events")
    .update({ event_date: value })
    .eq("luma_event_id", lumaEventId);
  if (error) throw new Error(error.message);
  revalidatePath("/events");
  revalidatePath(`/events/${encodeURIComponent(lumaEventId)}`);
}
```

- [ ] **Step 2: Write the date editor**

```tsx
// components/event-date-editor.tsx
"use client";
import { useState, useTransition } from "react";
import { updateEventDate } from "@/app/(protected)/events/[id]/actions";

export function EventDateEditor({
  lumaEventId,
  initial,
}: {
  lumaEventId: string;
  initial: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ? initial.slice(0, 10) : "");
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-violet-600 hover:text-violet-700"
      >
        Edit date
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          try {
            await updateEventDate(
              lumaEventId,
              value ? `${value}T00:00:00.000Z` : null,
            );
            setEditing(false);
          } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
          }
        });
      }}
      className="flex items-center gap-2"
    >
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 rounded-md border border-zinc-200 px-2 text-sm dark:border-zinc-700"
      />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs text-violet-600 hover:text-violet-700"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-zinc-500 hover:text-zinc-700"
      >
        Cancel
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </form>
  );
}
```

- [ ] **Step 3: Write the detail page**

```tsx
// app/(protected)/events/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getEvent, listEventAttendance } from "@/lib/events";
import { Section } from "@/components/ui/section";
import { formatDate } from "@/lib/format";
import { ApprovalPie } from "@/components/charts/approval-pie";
import { RegistrationVsCheckin } from "@/components/charts/registration-vs-checkin";
import { EventAttendanceTable } from "@/components/event-attendance-table";
import { EventDateEditor } from "@/components/event-date-editor";

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = decodeURIComponent(params.id);
  const event = await getEvent(id);
  if (!event) notFound();
  const attendance = await listEventAttendance(id);

  const invited = attendance.filter((a) => a.approval_status === "invited").length;
  const approved = attendance.filter((a) => a.approval_status === "approved").length;
  const declined = attendance.filter((a) => a.approval_status === "declined").length;
  const registered = invited + approved;
  const checkedIn = attendance.filter((a) => a.checked_in_at).length;

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-6">
        <Link
          href="/events"
          className="text-xs text-violet-600 hover:text-violet-700"
        >
          ← All events
        </Link>
        <h1 className="mt-2 font-display text-[32px] font-normal leading-tight tracking-tight-2 text-zinc-900 dark:text-zinc-50">
          {event.name}
        </h1>
        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{formatDate(event.event_date)}</span>
          <EventDateEditor lumaEventId={id} initial={event.event_date} />
          <span className="font-mono">{id}</span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Registered" value={registered} />
        <Stat label="Approved" value={approved} />
        <Stat label="Checked in" value={checkedIn} />
        <Stat
          label="Show rate"
          value={
            approved === 0 ? "—" : `${Math.round((checkedIn / approved) * 100)}%`
          }
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Section title="Approval breakdown">
          <ApprovalPie data={{ invited, approved, declined }} />
        </Section>
        <Section title="Registered vs checked-in">
          <RegistrationVsCheckin data={{ registered, checked_in: checkedIn }} />
        </Section>
      </div>

      <EventAttendanceTable rows={attendance} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/(protected)/events/[id]/page.tsx app/(protected)/events/[id]/actions.ts components/event-date-editor.tsx
git commit -m "feat(events): detail page with charts, stats, and date override"
```

---

## Task 17: Event History on member detail

**Files:**
- Modify: `app/(protected)/members/[id]/page.tsx`

- [ ] **Step 1: Fetch and render**

At the top of the component, extend the `Promise.all` to also call `listMemberEventHistory(memberApiId)`. Add a new section after `<ChangeHistory … />`:

```tsx
import { listMemberEventHistory } from "@/lib/events";
// …
const [member, eboardRows, edits, eventHistory] = await Promise.all([
  getMember(memberApiId),
  listEboardEntries(),
  listMemberEdits(memberApiId, 20),
  listMemberEventHistory(memberApiId),
]);
// …
<EventHistory eventHistory={eventHistory} />

function EventHistory({
  eventHistory,
}: {
  eventHistory: Awaited<ReturnType<typeof listMemberEventHistory>>;
}) {
  if (eventHistory.length === 0) return null;
  return (
    <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Event history ({eventHistory.length})
      </h2>
      <table className="w-full text-xs">
        <thead className="text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="py-1 pr-3 text-left font-medium">Date</th>
            <th className="py-1 pr-3 text-left font-medium">Event</th>
            <th className="py-1 pr-3 text-left font-medium">Status</th>
            <th className="py-1 text-left font-medium">Checked in</th>
          </tr>
        </thead>
        <tbody>
          {eventHistory.map((e) => (
            <tr
              key={e.luma_event_id}
              className="border-t border-zinc-100 dark:border-zinc-800"
            >
              <td className="py-1 pr-3 font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                {formatDate(e.event_date)}
              </td>
              <td className="py-1 pr-3">
                <Link
                  href={`/events/${encodeURIComponent(e.luma_event_id)}`}
                  className="text-violet-600 hover:text-violet-700"
                >
                  {e.name}
                </Link>
              </td>
              <td className="py-1 pr-3">{e.approval_status}</td>
              <td className="py-1">
                {e.checked_in_at ? formatDate(e.checked_in_at) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(protected)/members/[id]/page.tsx
git commit -m "feat(members): event history section on detail page"
```

---

## Task 18: Attendance-over-time on analytics

**Files:**
- Modify: `lib/analytics.ts`
- Create: `components/charts/attendance-over-time.tsx`
- Modify: `app/(protected)/analytics/page.tsx`

- [ ] **Step 1: Extend the analytics query**

In `lib/analytics.ts`, extend the `AnalyticsData` type with:

```ts
attendanceOverTime: { label: string; date: string | null; checkedIn: number }[];
```

In `getAnalytics`, after the existing reads, add:

```ts
const { data: evts, error: evErr } = await supabaseServer
  .from("events")
  .select("luma_event_id, name, event_date, checked_in_count")
  .order("event_date", { ascending: true, nullsFirst: true });
if (evErr) throw new Error(evErr.message);
const attendanceOverTime = (evts ?? []).map((e: any) => ({
  label: e.name,
  date: e.event_date,
  checkedIn: e.checked_in_count ?? 0,
}));
```

Add `attendanceOverTime` to the returned object.

- [ ] **Step 2: Write the chart**

```tsx
"use client";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartTheme } from "./use-chart-theme";

export function AttendanceOverTimeChart({
  data,
}: {
  data: { label: string; date: string | null; checkedIn: number }[];
}) {
  const t = useChartTheme();
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md bg-zinc-50 text-xs text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
        No events yet
      </div>
    );
  }
  const rows = data.map((d) => ({
    x: d.date ? d.date.slice(0, 10) : d.label,
    checkedIn: d.checkedIn,
    label: d.label,
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={t.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            stroke={t.axis}
            tick={{ fill: t.tick, fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis stroke={t.axis} tick={{ fill: t.tick, fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: t.tooltipBg,
              border: "none",
              borderRadius: 4,
              color: t.tooltipText,
              fontSize: 12,
            }}
            formatter={(v, _name, p) => [`${v} checked in`, p.payload.label]}
          />
          <Bar dataKey="checkedIn" fill={t.accent} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Wire into the analytics page**

In `app/(protected)/analytics/page.tsx`, add the chart as a new grid cell spanning full-width at the end:

```tsx
<Section
  title="Attendance over time"
  subtitle="Checked-in guests per event, oldest → newest"
  className="md:col-span-2"
>
  <AttendanceOverTimeChart data={a.attendanceOverTime} />
</Section>
```

Also add the import.

- [ ] **Step 4: Commit**

```bash
git add lib/analytics.ts components/charts/attendance-over-time.tsx app/(protected)/analytics/page.tsx
git commit -m "feat(analytics): attendance over time chart"
```

---

## Task 19: Import history — group by batch, show event context

**Files:**
- Modify: `app/(protected)/import/history/page.tsx`
- Modify: `app/(protected)/import/history/[id]/page.tsx`

- [ ] **Step 1: History list — group by batch_id**

Update the `.select(…)` to also request `source_type, luma_event_id, luma_event_name, batch_id`. After fetching rows, group in-memory: rows sharing a non-null `batch_id` belong to one group; rows with null `batch_id` are their own group. Render each group as a fieldset with its header summary (date, uploader, N files, overall status), and a `<details>` for the file list.

Code sketch:

```ts
type Row = /* same fields as before + source_type, luma_event_id, luma_event_name, batch_id */;
type Group = { key: string; rows: Row[]; uploaded_at: string; uploaded_by: string };

function groupByBatch(rows: Row[]): Group[] {
  const groups = new Map<string, Row[]>();
  const solos: Row[] = [];
  for (const r of rows) {
    if (r.batch_id) {
      const list = groups.get(r.batch_id) ?? [];
      list.push(r);
      groups.set(r.batch_id, list);
    } else {
      solos.push(r);
    }
  }
  const out: Group[] = [];
  for (const [id, rs] of groups) {
    rs.sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at));
    out.push({ key: id, rows: rs, uploaded_at: rs[0].uploaded_at, uploaded_by: rs[0].uploaded_by });
  }
  for (const r of solos) out.push({ key: r.id, rows: [r], uploaded_at: r.uploaded_at, uploaded_by: r.uploaded_by });
  return out.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
}
```

In the rendered row, show `luma_event_name` (italic, small) under the filename when `source_type === "event"`.

- [ ] **Step 2: History detail — show event metadata**

In `app/(protected)/import/history/[id]/page.tsx`, if `imp.source_type === "event"`, show an extra row under the date line:

```tsx
{imp.source_type === "event" && imp.luma_event_id && (
  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
    Event: <Link href={`/events/${encodeURIComponent(imp.luma_event_id)}`} className="text-violet-600 hover:text-violet-700">
      {imp.luma_event_name ?? imp.luma_event_id}
    </Link>
  </p>
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/(protected)/import/history/page.tsx app/(protected)/import/history/[id]/page.tsx
git commit -m "feat(import/history): group by batch, show event context"
```

---

## Task 20: README schema + migrations update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add events + event_attendance to the baseline schema block**

Below `create table member_edits (…)`, append:

```sql
create table events (
  luma_event_id text primary key,
  name text not null,
  event_date timestamptz,
  first_imported_at timestamptz default now(),
  last_imported_at timestamptz default now(),
  registered_count int default 0,
  approved_count int default 0,
  checked_in_count int default 0
);

create table event_attendance (
  luma_event_id text not null references events(luma_event_id) on delete cascade,
  member_user_api_id text not null references members(user_api_id) on delete cascade,
  guest_api_id text,
  approval_status text check (approval_status in ('invited','approved','declined')),
  registered_at timestamptz,
  checked_in_at timestamptz,
  primary key (luma_event_id, member_user_api_id)
);
```

- [ ] **Step 2: Add 0004 to the Migrations section**

Append to the bulleted list in `### Migrations`:

```md
- `supabase/migrations/0004_events_and_multi_csv.sql` — adds the
  `events` + `event_attendance` tables, `members.source`, and
  `source_type`/`luma_event_id`/`luma_event_name`/`batch_id` columns on
  `luma_imports`. Idempotent — safe to re-run.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document events tables and 0004 migration"
```

---

## Task 21: End-to-end verification

**Files:** none (this is the verification step).

Per `superpowers:verification-before-completion`: evidence before assertions.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: every test passes. Record the count.

- [ ] **Step 2: Run the typecheck / build**

Run: `npm run build`
Expected: succeeds. If Next.js fails at page-pre-rendering because the DB is empty, that's fine (we verify manually in Step 3).

- [ ] **Step 3: Apply 0004 in a scratch Supabase**

If the user has a scratch project, paste 0004 into the SQL editor and run it. Confirm no errors (it's fully idempotent — re-run once to verify).

- [ ] **Step 4: Manual exercise**

`npm run dev`. Sign in. Exercise the following:

1. `/import`: drop `tests/fixtures/1_base.csv` + `tests/fixtures/6_event_guests.csv` together. Confirm both cards render, detected types match, no dry-run. Without the 0004 migration applied, the event path will fail — that's expected if the user hasn't applied it yet.
2. `/events`: the event from step 1 appears at the top of the timeline.
3. `/events/[id]`: charts render, attendee table shows 5 rows, date override works.
4. `/members/<one of the auto-created>`: Event history section shows the event with the right status.
5. `/analytics`: the new Attendance-over-time chart shows a bar.
6. `/import/history`: the batch groups the two files together; each file has a detail page with the right source_type + event link.

Record anything that breaks and fix in-place before moving on. Do NOT claim the work is done unless every box above is verified.

- [ ] **Step 5: Do NOT push**

The user will review manually. After Task 21 passes:

```bash
git status
git log --oneline main..HEAD
```

Expected: clean tree, ~20 commits on the branch. Report the log to the user. Stop there.

---

## Followups (out of scope for this plan)

Recorded here so future work is findable; do not implement in this pass.

1. **Subscribed ↔ event counter reconciliation.** After an event import the `members.event_*_count` values are recomputed from `event_attendance`. Importing a subscribed CSV later overwrites them with the CSV's aggregates. Last-write-wins is fine for a small club but should be replaced by an explicit policy — e.g., a scheduled full recompute from `event_attendance` ignoring subscribed aggregates.
2. **Rekey event-only members.** A member auto-created from an event CSV has `user_api_id = gst-...`. If the same person later appears in a subscribed CSV under `usr_...`, we insert a second row. Long-term fix: match by normalized email first, prefer the `usr_...` id, move the event_attendance FK to the new id, delete the orphan.
3. **Custom registration questions.** The event parser drops columns like `GSU Email?`, `SMS opt-in`, etc. into `unmapped_headers`. A future pass should import selected custom columns into a typed `event_registration_answers` table.
4. **Event edit UI beyond `event_date`.** Rename, delete, merge two misidentified events, or manually set `registered/approved/checked_in_count`.
5. **Cohort & retention charts.** Multi-event analytics — "who came to ≥3 events", "what % of Sept attendees returned in Oct".
6. **Bulk recompute CLI.** For when a bug corrupted `event_attendance` or `members.event_*_count` and we need a one-shot restore.
