# Progbase CSV Import Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Luma CSV import tolerant of renamed/reordered columns, re-import friendly (counts never go backwards, join dates never move forward), auditable (per-import and per-member change logs), and supportive of a "preview (don't save)" dry-run mode.

**Architecture:** Three pure libs under `lib/` (`csv-headers`, `csv-row`, `csv-merge`) do all the header normalization, row cleaning, and merge-policy math — all unit-testable. The server action in `app/(protected)/import/actions.ts` orchestrates: parse → map → classify → upsert → log per-field `member_edits`. Schema changes are additive `alter table … add column if not exists …` so the migration is idempotent and the existing `luma_imports` primary key `id` doubles as the spec's `import_id`. The existing per-field `member_edits` table is evolved in place with `import_id`, `source`, `changed_by` columns — the change-history UI renders per-field rows as "field: old → new", achieving the same UX as a JSONB diff without rewriting storage. A `dry_run boolean` column on `luma_imports` lets preview runs be filtered out of history.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase (service-role client, server-only), NextAuth, papaparse, vitest.

---

## File structure

### Create

- `supabase/migrations/0002_import_hardening.sql` — idempotent additive schema changes, run manually in Supabase SQL editor.
- `lib/csv-headers.ts` — pure: normalize CSV header strings, map aliases to canonical fields, surface unmapped + missing.
- `lib/csv-row.ts` — pure: given a raw CSV row + header mapping, produce a cleaned/typed row or a per-row error.
- `lib/csv-merge.ts` — pure: given an incoming parsed row + existing DB row, return the merged Luma-fields write-set and a per-field diff.
- `lib/member-edits.ts` — server helper: fetch recent edits for a member, fetch edits for an import.
- `app/(protected)/import/history/page.tsx` — server component: last 50 imports.
- `app/(protected)/import/history/[id]/page.tsx` — server component: one import's detail (summary, mapping, errors, edits).
- `tests/csv-headers.test.ts` — covers exact headers, variants, aliases, reorders, extras, missing required, tie-breaking.
- `tests/csv-row.test.ts` — valid row, bad email, blank user_api_id, non-numeric counts, bad date, synthesized name.
- `tests/csv-merge.test.ts` — MAX counts, MIN first_seen, prefer-incoming strings, editable-fields untouched, new-row passthrough.

### Modify

- `components/nav-links.tsx` — prepend a disabled "Events *(in the works)*" item.
- `components/csv-dropzone.tsx` — dry-run toggle, render the new result shape (big numbers row, header mapping panel, errors table).
- `lib/types.ts` — extend `LumaImport` (new columns) and add `MemberEdit`.
- `app/(protected)/import/actions.ts` — full rewrite per spec §4 + dry-run support.
- `app/(protected)/import/page.tsx` — "View recent imports" link at top; keep the existing "Last import" block.
- `app/(protected)/members/[id]/page.tsx` — add a "Change history" section (last 20, newest first).
- `app/_actions/members.ts` — populate `source='manual'` and `changed_by` on the `member_edits` insert; no behavior change.
- `app/(protected)/blacklist/actions.ts` — populate `source='manual'` and `changed_by` on the `member_edits` insert.
- `README.md` — replace the inline `Schema` SQL block with a pointer to `supabase/migrations/`; add the new migration filename.

### Delete

- `lib/csv.ts` — superseded by `csv-headers.ts` + `csv-row.ts`.
- `tests/csv.test.ts` — targets removed code; replaced by three focused test files.

### Not touched

- `auth.ts`, `auth.config.ts`, middleware, `lib/allowlist.ts`, `lib/supabase-server.ts`, `lib/supabase-browser.ts`, `app/api/**`, `app/(public)/**`, `app/(protected)/layout.tsx`, `app/(protected)/analytics/**`, `app/(protected)/eboard/**`, `lib/eboard.ts`, `lib/eboard-db.ts`, `lib/analytics.ts`, `lib/freshness.ts` (keeps reading `uploaded_at`/`uploaded_by` which we preserve).

---

## Task 1: Add "Events *(in the works)*" nav placeholder

**Files:**
- Modify: `components/nav-links.tsx`

- [ ] **Step 1: Replace the NAV array and rendering with the disabled-item-aware version**

Open `components/nav-links.tsx` and replace the whole file contents with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  disabled?: boolean;
  tag?: string;
};

const NAV: NavItem[] = [
  { href: "/events", label: "Events", disabled: true, tag: "in the works" },
  { href: "/", label: "Members" },
  { href: "/eboard", label: "E-board" },
  { href: "/analytics", label: "Analytics" },
  { href: "/import", label: "Import" },
  { href: "/blacklist", label: "Blacklist" },
];

export function NavLinks() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="hidden items-center gap-6 md:flex">
      {NAV.map((item) => {
        if (item.disabled) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className="relative flex h-14 items-center gap-1.5 text-[13px] font-medium text-zinc-400 dark:text-zinc-500"
            >
              {item.label}
              {item.tag && (
                <span className="text-[10px] font-normal italic text-zinc-400 dark:text-zinc-500">
                  ({item.tag})
                </span>
              )}
            </span>
          );
        }
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex h-14 items-center text-[13px] font-medium transition-colors",
              active
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50",
            )}
          >
            {item.label}
            {active && (
              <span className="absolute inset-x-0 -bottom-px h-[2px] bg-violet-600 dark:bg-violet-400" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Typecheck and smoke-test**

Run: `npm run build 2>&1 | tail -20`
Expected: build succeeds; no new errors referencing `nav-links.tsx`.

Manual: `npm run dev`, open any protected page, confirm "Events (in the works)" appears leftmost in the nav, looks muted, is not a link (hover does not change cursor to pointer because it's a `<span>`).

- [ ] **Step 3: Commit**

```bash
git add components/nav-links.tsx
git commit -m "nav: add disabled Events placeholder (in the works)"
```

---

## Task 2: Write migration SQL (do not run)

**Files:**
- Create: `supabase/migrations/0002_import_hardening.sql`

- [ ] **Step 1: Create the migration directory and file**

```bash
mkdir -p supabase/migrations
```

Write `supabase/migrations/0002_import_hardening.sql` with this exact content:

```sql
-- 0002_import_hardening.sql
-- Idempotent additive schema changes for CSV import hardening.
-- Run manually in Supabase SQL Editor. Safe to re-run.

-- luma_imports: add new columns. Keep existing uploaded_by/uploaded_at/
-- storage_path/status for back-compat. The existing primary key `id`
-- continues to serve as the "import_id" referenced by member_edits.
alter table luma_imports add column if not exists filename text;
alter table luma_imports add column if not exists file_size_bytes int;
alter table luma_imports add column if not exists unchanged_count int;
alter table luma_imports add column if not exists header_mapping jsonb;
alter table luma_imports add column if not exists unmapped_headers text[];
alter table luma_imports add column if not exists errors jsonb;
alter table luma_imports add column if not exists dry_run boolean not null default false;

-- member_edits: evolve the existing per-field log to also capture source
-- and the triggering import. Existing rows default to source='manual'.
alter table member_edits add column if not exists import_id uuid
  references luma_imports(id) on delete set null;
alter table member_edits add column if not exists source text not null
  default 'manual';
alter table member_edits add column if not exists changed_by text;

-- Guard source values. Dropped-then-recreated so re-runs are idempotent.
alter table member_edits drop constraint if exists member_edits_source_check;
alter table member_edits add constraint member_edits_source_check
  check (source in ('import','manual'));

create index if not exists member_edits_import_idx on member_edits(import_id);

-- Normalized-email generated columns for reliable matching/joins.
alter table members add column if not exists email_normalized text
  generated always as (lower(trim(email))) stored;
create index if not exists members_email_norm_idx on members(email_normalized);

alter table blacklist add column if not exists email_normalized text
  generated always as (lower(trim(email))) stored;
create index if not exists blacklist_email_norm_idx on blacklist(email_normalized);

-- Index for analytics / history queries.
create index if not exists members_first_seen_idx on members(first_seen);
```

- [ ] **Step 2: Verify SQL syntactically**

This file is not executed by the app. If you have `psql` locally with access to a scratch Postgres, you can eyeball-verify:

```bash
cat supabase/migrations/0002_import_hardening.sql
```

Expected: the file content prints verbatim. No action taken.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_import_hardening.sql
git commit -m "schema: 0002 import hardening migration (not yet applied)"
```

---

## Task 3: `lib/csv-headers.ts` — header alias mapping (TDD)

**Files:**
- Create: `tests/csv-headers.test.ts`
- Create: `lib/csv-headers.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/csv-headers.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests — expect failure**

Run: `npm test -- tests/csv-headers.test.ts`
Expected: fails with "Cannot find module '../lib/csv-headers'" (or equivalent).

- [ ] **Step 3: Write the implementation**

Write `lib/csv-headers.ts`:

```ts
export type CanonicalField =
  | "user_api_id"
  | "name"
  | "first_name"
  | "last_name"
  | "email"
  | "first_seen"
  | "tags"
  | "event_approved_count"
  | "event_checked_in_count"
  | "membership_name"
  | "membership_status";

const ALIASES: Record<CanonicalField, readonly string[]> = {
  user_api_id: ["user_api_id", "api_id", "luma_id", "user_id", "id"],
  name: ["name", "full_name", "member_name"],
  first_name: ["first_name", "firstname", "given_name", "first"],
  last_name: ["last_name", "lastname", "surname", "family_name", "last"],
  email: ["email", "email_address", "e_mail", "mail"],
  first_seen: [
    "first_seen",
    "joined",
    "joined_at",
    "date_joined",
    "signup_date",
    "created_at",
    "registered_at",
  ],
  tags: ["tags", "labels"],
  event_approved_count: [
    "event_approved_count",
    "events_approved",
    "approved_events",
    "approved",
    "rsvps",
    "rsvp_count",
  ],
  event_checked_in_count: [
    "event_checked_in_count",
    "events_checked_in",
    "checked_in",
    "check_ins",
    "checkins",
    "attended",
    "attendance",
  ],
  membership_name: ["membership_name", "membership", "plan", "tier"],
  membership_status: ["membership_status", "status", "member_status"],
};

const REQUIRED: readonly CanonicalField[] = ["user_api_id", "name", "email"];

function normalize(raw: string): string {
  return raw
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function mapHeaders(rawHeaders: string[]): {
  mapping: Record<string, CanonicalField>;
  unmapped: string[];
  missingRequired: CanonicalField[];
} {
  const aliasToCanonical = new Map<string, CanonicalField>();
  for (const canonical of Object.keys(ALIASES) as CanonicalField[]) {
    for (const a of ALIASES[canonical]) aliasToCanonical.set(a, canonical);
  }

  type Candidate = { raw: string; normalized: string };
  const candidates = new Map<CanonicalField, Candidate[]>();
  const unmapped: string[] = [];

  for (const raw of rawHeaders) {
    const norm = normalize(raw);
    const canonical = aliasToCanonical.get(norm);
    if (!canonical) {
      unmapped.push(raw);
      continue;
    }
    const list = candidates.get(canonical) ?? [];
    list.push({ raw, normalized: norm });
    candidates.set(canonical, list);
  }

  const mapping: Record<string, CanonicalField> = {};
  for (const [canonical, list] of candidates.entries()) {
    const exact = list.find((c) => c.normalized === canonical);
    const picked = exact ?? list[0];
    mapping[picked.raw] = canonical;
    for (const c of list) {
      if (c.raw !== picked.raw) unmapped.push(c.raw);
    }
  }

  const mappedCanonical = new Set<CanonicalField>(Object.values(mapping));
  const missingRequired = REQUIRED.filter((r) => !mappedCanonical.has(r));

  return { mapping, unmapped, missingRequired };
}
```

- [ ] **Step 4: Run the tests — expect pass**

Run: `npm test -- tests/csv-headers.test.ts`
Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/csv-headers.ts tests/csv-headers.test.ts
git commit -m "feat(csv): fuzzy header mapping with alias table"
```

---

## Task 4: `lib/csv-row.ts` — row parsing + cleaning (TDD)

**Files:**
- Create: `tests/csv-row.test.ts`
- Create: `lib/csv-row.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/csv-row.test.ts`:

```ts
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
  membership_name: "membership_name",
  membership_status: "membership_status",
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
        membership_name: "Pro",
        membership_status: "Approved",
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
      tags: "newbie",
      event_approved_count: 3,
      event_checked_in_count: 2,
      membership_name: "Pro",
      membership_status: "approved",
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
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- tests/csv-row.test.ts`
Expected: fails to import `../lib/csv-row`.

- [ ] **Step 3: Write the implementation**

Write `lib/csv-row.ts`:

```ts
import type { CanonicalField } from "./csv-headers";

export type ParsedRow = {
  user_api_id: string;
  name: string;
  email: string | null;
  first_seen: string | null;
  tags: string | null;
  event_approved_count: number;
  event_checked_in_count: number;
  membership_name: string | null;
  membership_status: string | null;
};

export type ParseRowResult =
  | { ok: true; row: ParsedRow }
  | { ok: false; reason: string; email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(/\s+/g, " ");
  return s.length ? s : null;
}

function cleanInt(v: unknown): number {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim().replace(/,/g, "");
  if (!s) return 0;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function cleanDate(v: unknown): string | null {
  const s = cleanStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function parseRow(
  rawRow: Record<string, string | undefined>,
  mapping: Record<string, CanonicalField>,
): ParseRowResult {
  const byCanonical: Partial<Record<CanonicalField, string | undefined>> = {};
  for (const [csvHeader, canonical] of Object.entries(mapping)) {
    byCanonical[canonical] = rawRow[csvHeader];
  }

  const user_api_id = cleanStr(byCanonical.user_api_id) ?? "";
  if (!user_api_id) {
    return { ok: false, reason: "missing user_api_id" };
  }

  const rawEmail = cleanStr(byCanonical.email);
  const email = rawEmail ? rawEmail.toLowerCase() : null;
  if (email && !EMAIL_RE.test(email)) {
    return { ok: false, reason: `invalid email: ${email}`, email };
  }

  let name = cleanStr(byCanonical.name);
  if (!name) {
    const first = cleanStr(byCanonical.first_name);
    const last = cleanStr(byCanonical.last_name);
    const synth = [first ?? "", last ?? ""].join(" ").trim();
    name = synth.length ? synth : null;
  }
  if (!name) {
    return { ok: false, reason: "missing name", email: email ?? undefined };
  }

  const statusRaw = cleanStr(byCanonical.membership_status);

  return {
    ok: true,
    row: {
      user_api_id,
      name,
      email,
      first_seen: cleanDate(byCanonical.first_seen),
      tags: cleanStr(byCanonical.tags),
      event_approved_count: cleanInt(byCanonical.event_approved_count),
      event_checked_in_count: cleanInt(byCanonical.event_checked_in_count),
      membership_name: cleanStr(byCanonical.membership_name),
      membership_status: statusRaw ? statusRaw.toLowerCase() : null,
    },
  };
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- tests/csv-row.test.ts`
Expected: all 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/csv-row.ts tests/csv-row.test.ts
git commit -m "feat(csv): per-row parser with email/date/count normalization"
```

---

## Task 5: `lib/csv-merge.ts` — merge policy (TDD)

**Files:**
- Create: `tests/csv-merge.test.ts`
- Create: `lib/csv-merge.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/csv-merge.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- tests/csv-merge.test.ts`
Expected: fails to import `../lib/csv-merge`.

- [ ] **Step 3: Write the implementation**

Write `lib/csv-merge.ts`:

```ts
import type { ParsedRow } from "./csv-row";

export type LumaWriteSet = {
  user_api_id: string;
  name: string;
  email: string | null;
  first_seen: string | null;
  tags: string | null;
  event_approved_count: number;
  event_checked_in_count: number;
  membership_name: string | null;
  membership_status: string | null;
};

export type ExistingLuma = Partial<LumaWriteSet> & { user_api_id?: string };

export type FieldDiff = {
  field: Exclude<keyof LumaWriteSet, "user_api_id">;
  old: string | number | null;
  new: string | number | null;
};

function maxNum(a: number | null | undefined, b: number | null | undefined): number {
  return Math.max(a ?? 0, b ?? 0);
}

function minDate(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  if (!a && !b) return null;
  if (!a) return b ?? null;
  if (!b) return a ?? null;
  return a < b ? a : b;
}

function preferIncoming<T>(
  incoming: T | null,
  existing: T | null | undefined,
): T | null {
  return incoming !== null ? incoming : (existing ?? null);
}

const DIFFABLE_FIELDS: readonly FieldDiff["field"][] = [
  "name",
  "email",
  "first_seen",
  "tags",
  "event_approved_count",
  "event_checked_in_count",
  "membership_name",
  "membership_status",
];

export function mergeLumaFields(
  incoming: ParsedRow,
  existing: ExistingLuma | null,
): { merged: LumaWriteSet; diffs: FieldDiff[] } {
  const e = existing ?? {};
  const merged: LumaWriteSet = {
    user_api_id: incoming.user_api_id,
    name: preferIncoming(incoming.name, e.name) ?? incoming.name,
    email: preferIncoming(incoming.email, e.email),
    first_seen: minDate(incoming.first_seen, e.first_seen),
    tags: preferIncoming(incoming.tags, e.tags),
    event_approved_count: maxNum(
      incoming.event_approved_count,
      e.event_approved_count,
    ),
    event_checked_in_count: maxNum(
      incoming.event_checked_in_count,
      e.event_checked_in_count,
    ),
    membership_name: preferIncoming(incoming.membership_name, e.membership_name),
    membership_status: preferIncoming(
      incoming.membership_status,
      e.membership_status,
    ),
  };

  const diffs: FieldDiff[] = [];
  for (const f of DIFFABLE_FIELDS) {
    const oldVal = (e as Record<string, unknown>)[f];
    const oldNorm = oldVal === undefined ? null : (oldVal as string | number | null);
    const newNorm = merged[f] as string | number | null;
    if (oldNorm !== newNorm) {
      diffs.push({ field: f, old: oldNorm, new: newNorm });
    }
  }

  return { merged, diffs };
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- tests/csv-merge.test.ts`
Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/csv-merge.ts tests/csv-merge.test.ts
git commit -m "feat(csv): merge policy (MAX counts, MIN first_seen, prefer-incoming strings)"
```

---

## Task 6: Extend `lib/types.ts`

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Open `lib/types.ts` and append the new fields/types**

Edit `lib/types.ts`. Change `LumaImport` from:

```ts
export type LumaImport = {
  id: string;
  uploaded_by: string;
  uploaded_at: string;
  storage_path: string;
  row_count: number | null;
  new_count: number | null;
  updated_count: number | null;
  blocked_count: number | null;
  error_count: number | null;
  status: "success" | "partial" | "failed";
};
```

to:

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
};

export type ImportErrorRow = {
  row: number;
  reason: string;
  email?: string;
};

export type MemberEdit = {
  id: string;
  member_user_api_id: string;
  editor_email: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  import_id: string | null;
  source: "import" | "manual";
  changed_by: string | null;
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. `lib/freshness.ts` continues to compile because `LumaImport.uploaded_at` and `uploaded_by` still exist.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "types: extend LumaImport, add MemberEdit"
```

---

## Task 7: `lib/member-edits.ts` — server-side fetch helpers

**Files:**
- Create: `lib/member-edits.ts`

- [ ] **Step 1: Write the helper module**

Write `lib/member-edits.ts`:

```ts
import "server-only";
import { supabaseServer } from "./supabase-server";
import type { MemberEdit } from "./types";

export async function listMemberEdits(
  userApiId: string,
  limit = 20,
): Promise<MemberEdit[]> {
  const { data, error } = await supabaseServer
    .from("member_edits")
    .select("*")
    .eq("member_user_api_id", userApiId)
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to list member edits: ${error.message}`);
  return (data ?? []) as MemberEdit[];
}

export async function listImportEdits(importId: string): Promise<MemberEdit[]> {
  const { data, error } = await supabaseServer
    .from("member_edits")
    .select("*")
    .eq("import_id", importId)
    .order("changed_at", { ascending: false });
  if (error) throw new Error(`Failed to list import edits: ${error.message}`);
  return (data ?? []) as MemberEdit[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/member-edits.ts
git commit -m "feat(edits): server helper to fetch member/import change log"
```

---

## Task 8: Rewrite `app/(protected)/import/actions.ts`

**Files:**
- Modify: `app/(protected)/import/actions.ts` (full rewrite)

- [ ] **Step 1: Replace the whole file**

Overwrite `app/(protected)/import/actions.ts` with:

```ts
"use server";

import { auth } from "@/auth";
import { supabaseServer } from "@/lib/supabase-server";
import { isAllowed } from "@/lib/allowlist";
import { mapHeaders } from "@/lib/csv-headers";
import { parseRow, type ParsedRow } from "@/lib/csv-row";
import {
  mergeLumaFields,
  type LumaWriteSet,
  type FieldDiff,
} from "@/lib/csv-merge";
import { revalidatePath } from "next/cache";
import Papa from "papaparse";

const MAX_BYTES = 10 * 1024 * 1024;

export type ImportError = { row: number; reason: string; email?: string };

export type ImportResult =
  | {
      ok: true;
      import_id: string;
      dry_run: boolean;
      new_count: number;
      updated_count: number;
      unchanged_count: number;
      blocked_count: number;
      error_count: number;
      unmapped_headers: string[];
      header_mapping: Record<string, string>;
      errors: ImportError[];
    }
  | {
      ok: false;
      message: string;
      missing_required?: string[];
    };

async function requireEditorEmail(): Promise<string> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) throw new Error("Not signed in");
  if (!isAllowed(email, process.env.ALLOWED_EMAILS)) {
    throw new Error("Not authorized");
  }
  return email.trim().toLowerCase();
}

function storagePath(): string {
  const now = new Date();
  const stamp =
    now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14) +
    "-" +
    Math.random().toString(36).slice(2, 10);
  return `${stamp}.csv`;
}

export async function importCsv(
  formData: FormData,
  dryRun: boolean = false,
): Promise<ImportResult> {
  const editor = await requireEditorEmail();

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "No file provided" };
  if (file.size === 0) return { ok: false, message: "File is empty" };
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "File exceeds 10 MB limit" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = buffer.toString("utf-8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h,
  });

  const rawHeaders = parsed.meta.fields ?? [];
  const { mapping, unmapped, missingRequired } = mapHeaders(rawHeaders);
  if (missingRequired.length > 0) {
    return {
      ok: false,
      message: `Missing required column(s): ${missingRequired.join(", ")}`,
      missing_required: missingRequired,
    };
  }

  // Load blacklist (normalized emails).
  const blockedSet = new Set<string>();
  {
    const { data: blRows, error: blErr } = await supabaseServer
      .from("blacklist")
      .select("email_normalized");
    if (blErr) {
      return { ok: false, message: `Blacklist check failed: ${blErr.message}` };
    }
    for (const r of blRows ?? []) {
      const v = (r as { email_normalized: string | null }).email_normalized;
      if (v) blockedSet.add(v);
    }
  }

  // Parse + classify rows (in-memory, pre-write).
  const errors: ImportError[] = [];
  const parsedRows = new Map<string, ParsedRow>(); // dedupe by user_api_id; last wins
  let blockedCount = 0;

  parsed.data.forEach((raw, idx) => {
    const rowNum = idx + 2; // +1 for header row, +1 for 1-indexing
    const res = parseRow(raw as Record<string, string | undefined>, mapping);
    if (!res.ok) {
      errors.push({ row: rowNum, reason: res.reason, email: res.email });
      return;
    }
    const emailKey = res.row.email;
    if (emailKey && blockedSet.has(emailKey)) {
      blockedCount++;
      return;
    }
    parsedRows.set(res.row.user_api_id, res.row);
  });

  // Fetch existing members for the user_api_ids we're about to touch.
  const ids = Array.from(parsedRows.keys());
  const existingMap = new Map<string, Record<string, unknown>>();
  if (ids.length > 0) {
    const LUMA_COLS =
      "user_api_id, name, email, first_seen, tags, event_approved_count, event_checked_in_count, membership_name, membership_status";
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { data, error } = await supabaseServer
        .from("members")
        .select(LUMA_COLS)
        .in("user_api_id", chunk);
      if (error) {
        return {
          ok: false,
          message: `Existing-row check failed: ${error.message}`,
        };
      }
      for (const r of data ?? [])
        existingMap.set((r as { user_api_id: string }).user_api_id, r as Record<string, unknown>);
    }
  }

  // Merge incoming against existing; classify as new | updated | unchanged.
  const newRows: LumaWriteSet[] = [];
  const updatedRows: { write: LumaWriteSet; diffs: FieldDiff[] }[] = [];
  let unchangedCount = 0;
  for (const [id, incoming] of parsedRows) {
    const existing = existingMap.get(id) ?? null;
    const { merged, diffs } = mergeLumaFields(incoming, existing);
    if (!existing) {
      newRows.push(merged);
    } else if (diffs.length > 0) {
      updatedRows.push({ write: merged, diffs });
    } else {
      unchangedCount++;
    }
  }

  // Upload the raw CSV so we can replay later (skip on dry-run).
  const storage = dryRun ? "(dry-run)" : storagePath();
  if (!dryRun) {
    const { error: upErr } = await supabaseServer.storage
      .from("luma-csv")
      .upload(storage, buffer, { contentType: "text/csv" });
    if (upErr) {
      return { ok: false, message: `Storage upload failed: ${upErr.message}` };
    }
  }

  // Insert luma_imports row up-front so we have an id to reference from
  // member_edits. Leave counts null; patch at the end.
  const { data: imp, error: impErr } = await supabaseServer
    .from("luma_imports")
    .insert({
      uploaded_by: editor,
      storage_path: storage,
      filename: file.name,
      file_size_bytes: file.size,
      row_count: parsed.data.length,
      status: "success",
      header_mapping: mapping,
      unmapped_headers: unmapped,
      dry_run: dryRun,
    })
    .select("id")
    .single();
  if (impErr || !imp) {
    return {
      ok: false,
      message: `Import log failed: ${impErr?.message ?? "no id returned"}`,
    };
  }
  const importId = (imp as { id: string }).id;

  try {
    if (!dryRun) {
      // Upsert. Payload contains ONLY Luma-owned columns + user_api_id, so
      // editable fields (description, major, tags[], hidden, updated_by)
      // are never part of the onConflict overwrite set.
      const allWrites = [...newRows, ...updatedRows.map((u) => u.write)];
      if (allWrites.length > 0) {
        const nowIso = new Date().toISOString();
        const payload = allWrites.map((r) => ({ ...r, updated_at: nowIso }));
        const { error: upsertErr } = await supabaseServer
          .from("members")
          .upsert(payload, { onConflict: "user_api_id" });
        if (upsertErr) throw new Error(`Upsert failed: ${upsertErr.message}`);
      }

      // One member_edits row per changed field, per updated member.
      if (updatedRows.length > 0) {
        const editRows: Record<string, unknown>[] = [];
        for (const u of updatedRows) {
          for (const d of u.diffs) {
            editRows.push({
              member_user_api_id: u.write.user_api_id,
              editor_email: editor,
              field: d.field,
              old_value: d.old === null ? null : String(d.old),
              new_value: d.new === null ? null : String(d.new),
              source: "import",
              import_id: importId,
              changed_by: editor,
            });
          }
        }
        if (editRows.length > 0) {
          const { error: eErr } = await supabaseServer
            .from("member_edits")
            .insert(editRows);
          if (eErr) throw new Error(`Edit log failed: ${eErr.message}`);
        }
      }
    }

    const newCount = newRows.length;
    const updatedCount = updatedRows.length;
    const errorCount = errors.length;
    const wroteAnything = newCount + updatedCount + unchangedCount > 0;
    const status: "success" | "partial" | "failed" =
      errorCount === 0 ? "success" : wroteAnything ? "partial" : "failed";

    const { error: patchErr } = await supabaseServer
      .from("luma_imports")
      .update({
        new_count: newCount,
        updated_count: updatedCount,
        unchanged_count: unchangedCount,
        blocked_count: blockedCount,
        error_count: errorCount,
        errors,
        status,
      })
      .eq("id", importId);
    if (patchErr) {
      console.error("[importCsv] counts patch failed:", patchErr);
    }

    revalidatePath("/");
    revalidatePath("/analytics");
    revalidatePath("/import");
    revalidatePath("/import/history");

    return {
      ok: true,
      import_id: importId,
      dry_run: dryRun,
      new_count: newCount,
      updated_count: updatedCount,
      unchanged_count: unchangedCount,
      blocked_count: blockedCount,
      error_count: errorCount,
      unmapped_headers: unmapped,
      header_mapping: mapping,
      errors,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseServer
      .from("luma_imports")
      .update({
        error_count: parsed.data.length,
        errors: [{ row: 0, reason: msg }],
        status: "failed",
      })
      .eq("id", importId);
    throw new Error(`Import failed: ${msg}`);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`lib/csv.ts` is still referenced by the old dropzone for now — if tsc errors cite `parseLumaCsv`, that's expected and gets fixed in Task 11.)

- [ ] **Step 3: Commit**

```bash
git add app/\(protected\)/import/actions.ts
git commit -m "feat(import): rewrite server action w/ fuzzy headers, merge policy, dry-run"
```

---

## Task 9: Delete old `lib/csv.ts` and its test

**Files:**
- Delete: `lib/csv.ts`
- Delete: `tests/csv.test.ts`

- [ ] **Step 1: Confirm no other callers**

Run: `npx tsc --noEmit` — if the build references `@/lib/csv` from anywhere besides `components/csv-dropzone.tsx` or `app/(protected)/import/actions.ts`, stop and resolve. The dropzone is rewritten in Task 11; the action no longer imports `parseLumaCsv`.

Also: `grep -rn "from \"@/lib/csv\"" --include="*.ts" --include="*.tsx"` should only find `csv-dropzone.tsx` and (already removed) import action.

- [ ] **Step 2: Delete the files**

```bash
rm lib/csv.ts tests/csv.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add -A lib/csv.ts tests/csv.test.ts
git commit -m "chore: drop legacy lib/csv.ts (superseded by csv-headers/csv-row/csv-merge)"
```

---

## Task 10: Manual edit action — populate `source` / `changed_by`

**Files:**
- Modify: `app/_actions/members.ts`

- [ ] **Step 1: Extend the `member_edits.insert()` payload**

In `app/_actions/members.ts`, locate the insert at around line 103:

```ts
    const { error: logErr } = await supabaseServer.from("member_edits").insert(
      edits.map((e) => ({
        member_user_api_id: userApiId,
        editor_email: editor,
        field: e.field,
        old_value: e.old_value,
        new_value: e.new_value,
      })),
    );
```

Replace with:

```ts
    const { error: logErr } = await supabaseServer.from("member_edits").insert(
      edits.map((e) => ({
        member_user_api_id: userApiId,
        editor_email: editor,
        field: e.field,
        old_value: e.old_value,
        new_value: e.new_value,
        source: "manual",
        changed_by: editor,
        import_id: null,
      })),
    );
```

Locate the second insert at around line 160 (in `blockMember`):

```ts
    const { error: logErr } = await supabaseServer.from("member_edits").insert({
      member_user_api_id: userApiId,
      editor_email: editor,
      field: "hidden",
      old_value: "false",
      new_value: "true",
    });
```

Replace with:

```ts
    const { error: logErr } = await supabaseServer.from("member_edits").insert({
      member_user_api_id: userApiId,
      editor_email: editor,
      field: "hidden",
      old_value: "false",
      new_value: "true",
      source: "manual",
      changed_by: editor,
      import_id: null,
    });
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/_actions/members.ts
git commit -m "feat(edits): tag manual edits with source/changed_by"
```

---

## Task 11: Blacklist action — populate `source` / `changed_by`

**Files:**
- Modify: `app/(protected)/blacklist/actions.ts`

- [ ] **Step 1: Extend the `member_edits.insert()` payload**

In `app/(protected)/blacklist/actions.ts`, locate the insert at around line 74:

```ts
    const { error: logErr } = await supabaseServer.from("member_edits").insert(
      ids.map((id) => ({
        member_user_api_id: id,
        editor_email: editor,
        field: "hidden",
        old_value: "false",
        new_value: "true",
      })),
    );
```

Replace with:

```ts
    const { error: logErr } = await supabaseServer.from("member_edits").insert(
      ids.map((id) => ({
        member_user_api_id: id,
        editor_email: editor,
        field: "hidden",
        old_value: "false",
        new_value: "true",
        source: "manual",
        changed_by: editor,
        import_id: null,
      })),
    );
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(protected\)/blacklist/actions.ts
git commit -m "feat(edits): tag blacklist-driven hides with source/changed_by"
```

---

## Task 12: Rewrite `components/csv-dropzone.tsx`

**Files:**
- Modify: `components/csv-dropzone.tsx` (full rewrite)

- [ ] **Step 1: Replace the whole file**

Overwrite `components/csv-dropzone.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  importCsv,
  type ImportResult,
  type ImportError,
} from "@/app/(protected)/import/actions";
import { useRouter } from "next/navigation";

type ClientError = { message: string };
type State =
  | { kind: "idle" }
  | { kind: "file-error"; error: ClientError }
  | { kind: "server-result"; result: ImportResult };

export function CsvDropzone() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  function onFiles(files: FileList | null) {
    const f = files?.[0] ?? null;
    if (f && !f.name.toLowerCase().endsWith(".csv")) {
      setState({
        kind: "file-error",
        error: { message: "Only .csv files are accepted" },
      });
      setFile(null);
      return;
    }
    setFile(f);
    setState({ kind: "idle" });
  }

  function handleUpload() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setState({ kind: "idle" });
    startTransition(async () => {
      const res = await importCsv(fd, dryRun);
      setState({ kind: "server-result", result: res });
      if (res.ok && !res.dry_run) {
        setFile(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          dragOver
            ? "border-violet-400 bg-violet-50 dark:border-violet-500 dark:bg-violet-950/40"
            : "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
        }`}
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Drop CSV here, or{" "}
          <label className="cursor-pointer text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">
            browse
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Max 10 MB. Required columns: user_api_id, name, email.
        </p>
      </div>

      {file && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-zinc-900 dark:text-zinc-50">
              {file.name}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Preview (don&rsquo;t save)
          </label>
          <Button onClick={handleUpload} disabled={isPending}>
            {isPending
              ? dryRun
                ? "Previewing…"
                : "Uploading…"
              : dryRun
                ? "Preview"
                : "Upload"}
          </Button>
        </div>
      )}

      {state.kind === "file-error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {state.error.message}
          </p>
        </div>
      )}

      {state.kind === "server-result" && <ResultPanel result={state.result} />}
    </div>
  );
}

function ResultPanel({ result }: { result: ImportResult }) {
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {result.message}
        </p>
      </div>
    );
  }

  const tone = result.error_count > 0 ? "amber" : "green";
  const bucketClass =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30"
      : "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30";

  return (
    <div className={`space-y-3 rounded-lg border p-4 ${bucketClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {result.dry_run ? "Preview complete (nothing saved)" : "Import complete"}
        </p>
        <Link
          href={`/import/history/${result.import_id}`}
          className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          View details →
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip tone="green">{result.new_count} new</Chip>
        <Chip tone="violet">{result.updated_count} updated</Chip>
        <Chip tone="zinc">{result.unchanged_count} unchanged</Chip>
        <Chip tone="zinc">{result.blocked_count} blocked</Chip>
        <Chip tone={result.error_count ? "amber" : "zinc"}>
          {result.error_count} errors
        </Chip>
      </div>

      <HeaderMappingPanel
        mapping={result.header_mapping}
        unmapped={result.unmapped_headers}
      />

      {result.errors.length > 0 && <ErrorsTable errors={result.errors} />}
    </div>
  );
}

function HeaderMappingPanel({
  mapping,
  unmapped,
}: {
  mapping: Record<string, string>;
  unmapped: string[];
}) {
  const rows = Object.entries(mapping);
  return (
    <details className="rounded-md border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <summary className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300">
        Header mapping ({rows.length} mapped
        {unmapped.length ? `, ${unmapped.length} ignored` : ""})
      </summary>
      <div className="mt-3 space-y-3">
        {rows.length > 0 && (
          <table className="w-full text-xs">
            <thead className="text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="py-1 pr-3 text-left font-medium">CSV header</th>
                <th className="py-1 text-left font-medium">Canonical field</th>
              </tr>
            </thead>
            <tbody className="font-mono text-zinc-800 dark:text-zinc-200">
              {rows.map(([csv, canonical]) => (
                <tr key={csv}>
                  <td className="py-0.5 pr-3">{csv}</td>
                  <td className="py-0.5">{canonical}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {unmapped.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
              These columns were ignored:
            </p>
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {unmapped.join(", ")}
            </p>
          </div>
        )}
      </div>
    </details>
  );
}

function ErrorsTable({ errors }: { errors: ImportError[] }) {
  return (
    <details open className="rounded-md border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <summary className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300">
        Row errors ({errors.length})
      </summary>
      <table className="mt-3 w-full text-xs">
        <thead className="text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="py-1 pr-3 text-left font-medium">Row</th>
            <th className="py-1 pr-3 text-left font-medium">Email</th>
            <th className="py-1 text-left font-medium">Reason</th>
          </tr>
        </thead>
        <tbody className="text-zinc-800 dark:text-zinc-200">
          {errors.map((e, i) => (
            <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-1 pr-3 font-mono tabular-nums">{e.row}</td>
              <td className="py-1 pr-3 font-mono">{e.email ?? "—"}</td>
              <td className="py-1">{e.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
```

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -20`
Expected: no errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/csv-dropzone.tsx
git commit -m "feat(import/ui): dry-run toggle + new result panel (counts, mapping, errors)"
```

---

## Task 13: Update `/import` page — link to history

**Files:**
- Modify: `app/(protected)/import/page.tsx`

- [ ] **Step 1: Add the "View recent imports" link at the top**

In `app/(protected)/import/page.tsx`, find the header block:

```tsx
      <div className="mb-8">
        <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
          Data pipeline
        </span>
        <h1 className="mt-1 font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900 dark:text-zinc-50">
          Import Luma CSV
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          Upload the latest Luma members export. Existing e-board data —
          majors, tags, notes — is preserved on every re-import.
        </p>
      </div>
```

Replace with:

```tsx
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Data pipeline
          </span>
          <h1 className="mt-1 font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900 dark:text-zinc-50">
            Import Luma CSV
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Upload the latest Luma members export. Existing e-board data —
            majors, tags, notes — is preserved on every re-import.
          </p>
        </div>
        <Link
          href="/import/history"
          className="shrink-0 text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          View recent imports →
        </Link>
      </div>
```

Add the import at the top of the file, after the other imports:

```ts
import Link from "next/link";
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(protected\)/import/page.tsx
git commit -m "feat(import): link to /import/history from upload page"
```

---

## Task 14: Create `/import/history` list page

**Files:**
- Create: `app/(protected)/import/history/page.tsx`

- [ ] **Step 1: Write the page**

```bash
mkdir -p "app/(protected)/import/history"
```

Write `app/(protected)/import/history/page.tsx`:

```tsx
import "server-only";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { formatDate } from "@/lib/format";
import type { LumaImport } from "@/lib/types";

export default async function ImportHistoryPage() {
  const { data, error } = await supabaseServer
    .from("luma_imports")
    .select(
      "id, uploaded_at, uploaded_by, filename, row_count, new_count, updated_count, unchanged_count, blocked_count, error_count, status, dry_run",
    )
    .eq("dry_run", false)
    .order("uploaded_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to load imports: ${error.message}`);
  const rows = (data ?? []) as Array<Pick<LumaImport,
    | "id"
    | "uploaded_at"
    | "uploaded_by"
    | "filename"
    | "row_count"
    | "new_count"
    | "updated_count"
    | "unchanged_count"
    | "blocked_count"
    | "error_count"
    | "status"
    | "dry_run"
  >>;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Data pipeline
          </span>
          <h1 className="mt-1 font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900 dark:text-zinc-50">
            Import history
          </h1>
        </div>
        <Link
          href="/import"
          className="shrink-0 text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          ← Back to upload
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No imports yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="p-3 font-medium">Imported at</th>
                <th className="p-3 font-medium">By</th>
                <th className="p-3 font-medium">Filename</th>
                <th className="p-3 text-right font-medium">Rows</th>
                <th className="p-3 text-right font-medium">New</th>
                <th className="p-3 text-right font-medium">Updated</th>
                <th className="p-3 text-right font-medium">Unchanged</th>
                <th className="p-3 text-right font-medium">Blocked</th>
                <th className="p-3 text-right font-medium">Errors</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-950"
                >
                  <td className="p-3">
                    <Link
                      href={`/import/history/${r.id}`}
                      className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                    >
                      {formatDate(r.uploaded_at)}
                    </Link>
                  </td>
                  <td className="p-3 font-mono text-xs">{r.uploaded_by}</td>
                  <td className="p-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {r.filename ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {r.row_count ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {r.new_count ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {r.updated_count ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {r.unchanged_count ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {r.blocked_count ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {r.error_count ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -20`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add app/\(protected\)/import/history/page.tsx
git commit -m "feat(import): /import/history — recent imports list"
```

---

## Task 15: Create `/import/history/[id]` detail page

**Files:**
- Create: `app/(protected)/import/history/[id]/page.tsx`

- [ ] **Step 1: Write the page**

```bash
mkdir -p "app/(protected)/import/history/[id]"
```

Write `app/(protected)/import/history/[id]/page.tsx`:

```tsx
import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { listImportEdits } from "@/lib/member-edits";
import { Chip } from "@/components/ui/chip";
import { formatDate } from "@/lib/format";
import type { LumaImport, ImportErrorRow } from "@/lib/types";

export default async function ImportDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = decodeURIComponent(params.id);

  const { data, error } = await supabaseServer
    .from("luma_imports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load import: ${error.message}`);
  if (!data) notFound();
  const imp = data as LumaImport;

  const edits = await listImportEdits(id);
  const editedIds = Array.from(
    new Set(edits.map((e) => e.member_user_api_id)),
  );
  const memberById = new Map<string, { name: string | null; email: string | null }>();
  if (editedIds.length > 0) {
    const { data: mem, error: merr } = await supabaseServer
      .from("members")
      .select("user_api_id, name, email")
      .in("user_api_id", editedIds);
    if (merr) throw new Error(`Failed to load members: ${merr.message}`);
    for (const m of mem ?? []) {
      memberById.set((m as { user_api_id: string }).user_api_id, {
        name: (m as { name: string | null }).name,
        email: (m as { email: string | null }).email,
      });
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <Link
          href="/import/history"
          className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          ← All imports
        </Link>
        <h1 className="mt-2 font-display text-[28px] font-normal leading-tight tracking-tight-2 text-zinc-900 dark:text-zinc-50">
          Import on {formatDate(imp.uploaded_at)}
        </h1>
        <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          by {imp.uploaded_by} · {imp.filename ?? "(no filename)"}
          {imp.dry_run && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              · dry-run (nothing saved)
            </span>
          )}
        </p>
      </div>

      <section className="mb-6 flex flex-wrap gap-1.5">
        <Chip tone="green">{imp.new_count ?? 0} new</Chip>
        <Chip tone="violet">{imp.updated_count ?? 0} updated</Chip>
        <Chip tone="zinc">{imp.unchanged_count ?? 0} unchanged</Chip>
        <Chip tone="zinc">{imp.blocked_count ?? 0} blocked</Chip>
        <Chip tone={imp.error_count ? "amber" : "zinc"}>
          {imp.error_count ?? 0} errors
        </Chip>
        <Chip tone="zinc">{imp.row_count ?? 0} rows total</Chip>
      </section>

      <MappingSection
        mapping={imp.header_mapping ?? {}}
        unmapped={imp.unmapped_headers ?? []}
      />

      {imp.errors && imp.errors.length > 0 && (
        <ErrorsSection errors={imp.errors} />
      )}

      <EditsSection edits={edits} members={memberById} />
    </main>
  );
}

function MappingSection({
  mapping,
  unmapped,
}: {
  mapping: Record<string, string>;
  unmapped: string[];
}) {
  const rows = Object.entries(mapping);
  return (
    <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Header mapping
      </h2>
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No mapping recorded for this import.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="py-1 pr-3 text-left font-medium">CSV header</th>
              <th className="py-1 text-left font-medium">Canonical field</th>
            </tr>
          </thead>
          <tbody className="font-mono text-zinc-800 dark:text-zinc-200">
            {rows.map(([csv, canonical]) => (
              <tr key={csv}>
                <td className="py-0.5 pr-3">{csv}</td>
                <td className="py-0.5">{canonical}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {unmapped.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
            Ignored columns ({unmapped.length}):
          </p>
          <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {unmapped.join(", ")}
          </p>
        </div>
      )}
    </section>
  );
}

function ErrorsSection({ errors }: { errors: ImportErrorRow[] }) {
  return (
    <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
      <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Errors ({errors.length})
      </h2>
      <table className="w-full text-xs">
        <thead className="text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="py-1 pr-3 text-left font-medium">Row</th>
            <th className="py-1 pr-3 text-left font-medium">Email</th>
            <th className="py-1 text-left font-medium">Reason</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((e, i) => (
            <tr
              key={i}
              className="border-t border-amber-100 dark:border-amber-900/40"
            >
              <td className="py-1 pr-3 font-mono tabular-nums">{e.row}</td>
              <td className="py-1 pr-3 font-mono">{e.email ?? "—"}</td>
              <td className="py-1">{e.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EditsSection({
  edits,
  members,
}: {
  edits: Awaited<ReturnType<typeof listImportEdits>>;
  members: Map<string, { name: string | null; email: string | null }>;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Member changes ({edits.length})
      </h2>
      {edits.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No member changes were written by this import.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="py-1 pr-3 text-left font-medium">Member</th>
              <th className="py-1 pr-3 text-left font-medium">Field</th>
              <th className="py-1 pr-3 text-left font-medium">Old</th>
              <th className="py-1 text-left font-medium">New</th>
            </tr>
          </thead>
          <tbody>
            {edits.map((e) => {
              const m = members.get(e.member_user_api_id);
              return (
                <tr
                  key={e.id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="py-1 pr-3">
                    <Link
                      href={`/members/${encodeURIComponent(e.member_user_api_id)}`}
                      className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                    >
                      {m?.name ?? m?.email ?? e.member_user_api_id}
                    </Link>
                  </td>
                  <td className="py-1 pr-3 font-mono">{e.field}</td>
                  <td className="py-1 pr-3 font-mono text-zinc-600 dark:text-zinc-400">
                    {e.old_value ?? "—"}
                  </td>
                  <td className="py-1 font-mono text-zinc-900 dark:text-zinc-100">
                    {e.new_value ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -20`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/import/history/[id]/page.tsx"
git commit -m "feat(import): /import/history/[id] — per-import detail with mapping, errors, edits"
```

---

## Task 16: Member detail — Change history section

**Files:**
- Modify: `app/(protected)/members/[id]/page.tsx`

- [ ] **Step 1: Add imports**

In `app/(protected)/members/[id]/page.tsx`, at the top, add:

```ts
import { listMemberEdits } from "@/lib/member-edits";
import type { MemberEdit } from "@/lib/types";
```

- [ ] **Step 2: Fetch edits alongside member + eboard**

Replace the existing `Promise.all`:

```ts
  const [member, eboardRows] = await Promise.all([
    getMember(decodeURIComponent(params.id)),
    listEboardEntries(),
  ]);
  if (!member) notFound();
  const eboardEntries = eboardRows.map(toEntry);
```

with:

```ts
  const memberApiId = decodeURIComponent(params.id);
  const [member, eboardRows, edits] = await Promise.all([
    getMember(memberApiId),
    listEboardEntries(),
    listMemberEdits(memberApiId, 20),
  ]);
  if (!member) notFound();
  const eboardEntries = eboardRows.map(toEntry);
```

- [ ] **Step 3: Append the change-history section**

At the end of the JSX, just before the closing `</main>`, add:

```tsx
      <ChangeHistory edits={edits} />
```

And add a `ChangeHistory` component function at the bottom of the file, outside `MemberEditPage`:

```tsx
function ChangeHistory({ edits }: { edits: MemberEdit[] }) {
  if (edits.length === 0) {
    return (
      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Change history
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No changes logged yet.
        </p>
      </section>
    );
  }
  return (
    <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Change history
      </h2>
      <table className="w-full text-xs">
        <thead className="text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="py-1 pr-3 text-left font-medium">When</th>
            <th className="py-1 pr-3 text-left font-medium">Source</th>
            <th className="py-1 pr-3 text-left font-medium">Who</th>
            <th className="py-1 pr-3 text-left font-medium">Field</th>
            <th className="py-1 pr-3 text-left font-medium">Old</th>
            <th className="py-1 text-left font-medium">New</th>
          </tr>
        </thead>
        <tbody>
          {edits.map((e) => (
            <tr
              key={e.id}
              className="border-t border-zinc-100 dark:border-zinc-800"
            >
              <td className="py-1 pr-3 font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                {new Date(e.changed_at).toLocaleString()}
              </td>
              <td className="py-1 pr-3">
                <span
                  className={
                    e.source === "import"
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-zinc-700 dark:text-zinc-300"
                  }
                >
                  {e.source}
                </span>
              </td>
              <td className="py-1 pr-3 font-mono text-zinc-600 dark:text-zinc-400">
                {e.changed_by ?? e.editor_email}
              </td>
              <td className="py-1 pr-3 font-mono">{e.field}</td>
              <td className="py-1 pr-3 font-mono text-zinc-600 dark:text-zinc-400">
                {e.old_value ?? "—"}
              </td>
              <td className="py-1 font-mono text-zinc-900 dark:text-zinc-100">
                {e.new_value ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -20`
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/members/[id]/page.tsx"
git commit -m "feat(members): change history section on member detail page"
```

---

## Task 17: README — schema pointer

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the Schema section**

In `README.md`, find the Schema section header (`## Schema`) and everything up to the next `## Seeding`. Replace just the `## Schema` section body with:

```markdown
## Schema

The baseline tables are documented in the SQL block below. When we need to
evolve the schema, migration files live under `supabase/migrations/` and are
applied by pasting into the Supabase SQL Editor.

```sql
create table members (
  user_api_id text primary key,
  name text,
  email text,
  first_seen timestamptz,
  event_approved_count int default 0,
  event_checked_in_count int default 0,
  description text,
  major text,
  grad_year text,
  gender text,
  pronouns text,
  linkedin_url text,
  custom_tags text[],
  hidden boolean default false,
  updated_at timestamptz default now(),
  updated_by text
);

create table blacklist (
  email text primary key,
  name text,
  reason text not null,
  added_by text not null,
  added_at timestamptz default now()
);

create table luma_imports (
  id uuid primary key default gen_random_uuid(),
  uploaded_by text not null,
  uploaded_at timestamptz default now(),
  storage_path text not null,
  row_count int,
  new_count int,
  updated_count int,
  blocked_count int,
  error_count int,
  status text not null
);

create table member_edits (
  id uuid primary key default gen_random_uuid(),
  member_user_api_id text not null references members(user_api_id) on delete cascade,
  editor_email text not null,
  field text not null,
  old_value text,
  new_value text,
  changed_at timestamptz default now()
);

create index members_email_idx on members (lower(email));
create index members_name_idx on members (lower(name));
create index members_checked_in_idx on members (event_checked_in_count desc);
create index blacklist_email_idx on blacklist (lower(email));
create index luma_imports_uploaded_at_idx on luma_imports (uploaded_at desc);
create index member_edits_member_idx on member_edits (member_user_api_id, changed_at desc);
```

### Migrations

After the baseline is in place, apply migrations in order:

- `supabase/migrations/0002_import_hardening.sql` — adds header-mapping
  metadata to `luma_imports`, `import_id`/`source`/`changed_by` to
  `member_edits`, `email_normalized` generated columns to `members` and
  `blacklist`, and a dry-run flag. Idempotent — safe to re-run.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: point README to migrations/ and document 0002"
```

---

## Manual verification (smoke test)

Run through these steps after Task 17 before merging.

- [ ] `npm test` — all test files green; zero unhandled warnings.
- [ ] `npm run build` — clean build, no new TS errors.
- [ ] Paste `supabase/migrations/0002_import_hardening.sql` into Supabase SQL Editor; it runs clean. Re-run; still clean (idempotency).
- [ ] `npm run dev`; sign in as an allowlisted VP.
- [ ] Nav: "Events *(in the works)*" appears leftmost, muted, not a link.
- [ ] `/import`: "View recent imports →" link present at top-right. The existing "Last import" block still renders.
- [ ] Upload a small valid CSV. Result panel shows five chips (new / updated / unchanged / blocked / errors), a "Header mapping" panel listing only mapped columns, and no errors table.
- [ ] Click "View details →" — lands on `/import/history/[id]`. Counts match. Mapping panel shows the mapping. Member-changes table is populated (or empty with a friendly note on a fresh import).
- [ ] Upload the *same* CSV again. Expect the "updated" count to be 0 (or tiny, only fields that actually changed) and "unchanged" to be most of the file.
- [ ] Upload a CSV with a renamed column (e.g. `full_name` instead of `name`). Import succeeds; the history detail shows `full_name → name` in the mapping panel.
- [ ] Upload a CSV missing the `email` column. Server action returns an error banner "Missing required column(s): email" and no history row is written.
- [ ] Tick "Preview (don't save)" on a valid CSV. Result panel appears with counts, but `/members/*` rows do not change; `/import/history` does not list the dry-run row.
- [ ] Manual edit on `/members/[id]`: change a field. The Change history section shows a row with `source: manual` and the correct editor email. Field old/new render correctly.
- [ ] Re-import after a manual edit. If Luma's data agrees with the manual edit, "unchanged" increments; if Luma changes the field, "updated" increments and a new change-history row with `source: import` is logged.

---

## Followups (out of scope for this plan)

- **E-board name-matching false positives.** `lib/eboard.ts` matches by common first names (`fred`, `nina`, `dev`, `arhaan`, `carter`, `eda`, `ishan`, `greg`, `poorav`, `nkano`, `trang`, `ibe`) which over-matches members whose names contain those words. Convert the 10+ name-only entries in `EBOARD_SEED` / `eboard_entries` to email-based matches using the normalized-email column added here. One-shot script: join `members.email_normalized` to candidate entries, let the VP select the right row per e-board member, write emails back to `eboard_entries`.
- **Dry-run history view.** A toggle on `/import/history` to include `dry_run = true` rows, for operators who want to see preview runs.
- **Drop legacy `status` column** on `luma_imports` once the new counts-based fields are trusted. Requires a data migration to translate existing `partial`/`failed` rows.
- **Event page.** Replace the disabled nav placeholder with a real `/events` route.

---

## Notes on execution

- Tasks 1, 2, 17 are fully independent and can be picked up in isolation.
- Tasks 3–7 are independent of each other (all pure libs or type edits); can be parallelized if desired.
- Task 8 depends on 3, 4, 5, 6.
- Tasks 9, 10, 11 require the migration from Task 2 to be *applied* for runtime correctness, but the code changes themselves don't depend on it.
- Tasks 12, 13 depend on 8.
- Tasks 14, 15 depend on 7.
- Task 16 depends on 7.

In practice: do them in numerical order. Each task ends with a commit, so you can stop anywhere and resume.
