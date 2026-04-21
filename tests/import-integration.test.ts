// Load .env.local before any module that reads env at import time.
import "./setup-env";

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Mock NextAuth auth() to return an allowlisted user so requireEditorEmail() passes.
vi.mock("@/auth", () => ({
  auth: async () => ({ user: { email: "abrartsarwar@gmail.com" } }),
}));

// revalidatePath is a no-op outside Next runtime.
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

import { importCsv } from "@/app/(protected)/import/actions";
import { supabaseServer } from "@/lib/supabase-server";

const FIXTURES_DIR = resolve(__dirname, "fixtures");

type Member = {
  user_api_id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  first_seen: string;
  tags: string;
  event_approved_count: number;
  event_checked_in_count: number;
};

function baseMember(n: number): Member {
  const id = n.toString().padStart(3, "0");
  return {
    user_api_id: `usr-0${id}`,
    name: `Member ${n}`,
    first_name: `First${n}`,
    last_name: `Last${n}`,
    email: `member${n}@example.com`,
    first_seen: "2024-01-15T10:00:00Z",
    tags: "member",
    event_approved_count: 5 + (n % 10),
    event_checked_in_count: 3 + (n % 7),
  };
}

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(
  headers: string[],
  headerToField: Record<string, keyof Member>,
  members: Member[],
): string {
  const headerLine = headers.map(csvEscape).join(",");
  const rows = members.map((m) =>
    headers
      .map((h) => csvEscape(String(m[headerToField[h]] ?? "")))
      .join(","),
  );
  return [headerLine, ...rows].join("\n") + "\n";
}

const CANONICAL_HEADERS: string[] = [
  "user_api_id",
  "name",
  "first_name",
  "last_name",
  "email",
  "first_seen",
  "tags",
  "event_approved_count",
  "event_checked_in_count",
];

const identityMap: Record<string, keyof Member> = Object.fromEntries(
  CANONICAL_HEADERS.map((h) => [h, h as keyof Member]),
);

async function cleanupTestData() {
  await supabaseServer
    .from("member_edits")
    .delete()
    .like("member_user_api_id", "usr-0%");
  await supabaseServer
    .from("members")
    .delete()
    .like("user_api_id", "usr-0%");
  await supabaseServer
    .from("luma_imports")
    .delete()
    .like("filename", "test-%");
}

function toFormData(content: string, filename: string): FormData {
  const file = new File([content], filename, { type: "text/csv" });
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}

async function runImport(
  filename: string,
  fixturePath: string,
  dryRun = false,
) {
  const content = readFileSync(fixturePath, "utf-8");
  const result = await importCsv(toFormData(content, filename), dryRun);
  if (!result.ok) {
    console.error(`[${filename}] import failed:`, result.message);
  }
  return result;
}

beforeAll(async () => {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  // 1_base.csv — 40 members, all 11 canonical headers.
  const base40 = Array.from({ length: 40 }, (_, i) => baseMember(i + 1));
  writeFileSync(
    resolve(FIXTURES_DIR, "1_base.csv"),
    buildCsv(CANONICAL_HEADERS, identityMap, base40),
  );

  // 2_updated.csv — same 40 + 5 new. Bump counts on members 21-40 (20 updated).
  const updated = Array.from({ length: 45 }, (_, i) => {
    const m = baseMember(i + 1);
    if (i >= 20 && i < 40) {
      m.event_approved_count += 5;
      m.event_checked_in_count += 3;
    }
    return m;
  });
  writeFileSync(
    resolve(FIXTURES_DIR, "2_updated.csv"),
    buildCsv(CANONICAL_HEADERS, identityMap, updated),
  );

  // 3_renamed_headers.csv — 15 members, aliased headers.
  const renamedHeaders = [
    "Full Name",
    "Email Address",
    "joined_at",
    "luma_id",
    "labels",
    "events_approved",
    "check_ins",
  ];
  const renamedMap: Record<string, keyof Member> = {
    "Full Name": "name",
    "Email Address": "email",
    joined_at: "first_seen",
    luma_id: "user_api_id",
    labels: "tags",
    events_approved: "event_approved_count",
    check_ins: "event_checked_in_count",
  };
  // Members 1-7 identical to base (should be unchanged); members 8-15 with
  // bumped approved count (should be updated). Total: 15.
  const renamed15 = Array.from({ length: 15 }, (_, i) => {
    const m = baseMember(i + 1);
    if (i >= 7) m.event_approved_count += 2;
    return m;
  });
  writeFileSync(
    resolve(FIXTURES_DIR, "3_renamed_headers.csv"),
    buildCsv(renamedHeaders, renamedMap, renamed15),
  );

  // 4_missing_email.csv — email column removed entirely.
  const missingEmailHeaders = CANONICAL_HEADERS.filter((h) => h !== "email");
  const missingEmailMap: Record<string, keyof Member> = Object.fromEntries(
    missingEmailHeaders.map((h) => [h, h as keyof Member]),
  );
  const missing10 = Array.from({ length: 10 }, (_, i) => baseMember(i + 1));
  writeFileSync(
    resolve(FIXTURES_DIR, "4_missing_email.csv"),
    buildCsv(missingEmailHeaders, missingEmailMap, missing10),
  );

  // 5_stale_counts.csv — 10 members, counts set to 0 (lower than base).
  const stale10 = Array.from({ length: 10 }, (_, i) => {
    const m = baseMember(i + 1);
    m.event_approved_count = 0;
    m.event_checked_in_count = 0;
    return m;
  });
  writeFileSync(
    resolve(FIXTURES_DIR, "5_stale_counts.csv"),
    buildCsv(CANONICAL_HEADERS, identityMap, stale10),
  );

  await cleanupTestData();
}, 60_000);

afterAll(async () => {
  await cleanupTestData();
}, 30_000);

describe("import action (integration)", () => {
  it("1. baseline import inserts 40 new members", async () => {
    const result = await runImport(
      "test-1_base.csv",
      resolve(FIXTURES_DIR, "1_base.csv"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.new_count).toBe(40);
    expect(result.updated_count).toBe(0);
    expect(result.unchanged_count).toBe(0);
    expect(result.blocked_count).toBe(0);
    expect(result.error_count).toBe(0);
    expect(result.unmapped_headers).toEqual([]);

    const mappedCanonicals = new Set(Object.values(result.header_mapping));
    expect(mappedCanonicals.size).toBe(9);

    const { count } = await supabaseServer
      .from("members")
      .select("*", { count: "exact", head: true })
      .like("user_api_id", "usr-0%");
    expect(count).toBe(40);
  }, 60_000);

  it("2. re-importing the same file marks all 40 unchanged", async () => {
    const result = await runImport(
      "test-1_base_reimport.csv",
      resolve(FIXTURES_DIR, "1_base.csv"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.new_count).toBe(0);
    expect(result.updated_count).toBe(0);
    expect(result.unchanged_count).toBe(40);

    const { data, error } = await supabaseServer
      .from("member_edits")
      .select("id")
      .eq("import_id", result.import_id);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  }, 60_000);

  it("3. incremental update: 5 new, ~20 updated, rest unchanged", async () => {
    const result = await runImport(
      "test-2_updated.csv",
      resolve(FIXTURES_DIR, "2_updated.csv"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.new_count).toBe(5);
    expect(result.updated_count).toBeGreaterThan(10);
    expect(result.updated_count).toBeLessThan(30);
    expect(
      result.unchanged_count + result.updated_count + result.new_count,
    ).toBe(45);

    const { data, error } = await supabaseServer
      .from("member_edits")
      .select("id, source")
      .eq("import_id", result.import_id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    expect((data ?? []).every((r) => r.source === "import")).toBe(true);
  }, 60_000);

  it("4. fuzzy headers are mapped via aliases", async () => {
    const result = await runImport(
      "test-3_renamed.csv",
      resolve(FIXTURES_DIR, "3_renamed_headers.csv"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.header_mapping["Full Name"]).toBe("name");
    expect(result.header_mapping["Email Address"]).toBe("email");
    expect(result.header_mapping["luma_id"]).toBe("user_api_id");
    expect(result.header_mapping["joined_at"]).toBe("first_seen");
    expect(result.header_mapping["labels"]).toBe("tags");
    expect(result.header_mapping["events_approved"]).toBe(
      "event_approved_count",
    );
    expect(result.header_mapping["check_ins"]).toBe("event_checked_in_count");

    expect(result.new_count).toBe(0);
    expect(result.unchanged_count + result.updated_count).toBe(15);
  }, 60_000);

  it("5. missing required email column is rejected", async () => {
    const { count: membersBefore } = await supabaseServer
      .from("members")
      .select("*", { count: "exact", head: true })
      .like("user_api_id", "usr-0%");
    const { count: importsBefore } = await supabaseServer
      .from("luma_imports")
      .select("*", { count: "exact", head: true })
      .like("filename", "test-%");

    let result: Awaited<ReturnType<typeof importCsv>> | { ok: false; message: string };
    try {
      result = await runImport(
        "test-4_missing_email.csv",
        resolve(FIXTURES_DIR, "4_missing_email.csv"),
      );
    } catch (e) {
      result = { ok: false, message: e instanceof Error ? e.message : String(e) };
    }

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.toLowerCase()).toContain("email");

    const { count: membersAfter } = await supabaseServer
      .from("members")
      .select("*", { count: "exact", head: true })
      .like("user_api_id", "usr-0%");
    const { count: importsAfter } = await supabaseServer
      .from("luma_imports")
      .select("*", { count: "exact", head: true })
      .like("filename", "test-%");

    expect(membersAfter).toBe(membersBefore);
    expect(importsAfter).toBe(importsBefore);
  }, 60_000);

  it("6. MAX merge keeps higher DB counts when CSV has lower values", async () => {
    const ids = Array.from(
      { length: 10 },
      (_, i) => `usr-0${(i + 1).toString().padStart(3, "0")}`,
    );
    const { data: before, error: beforeErr } = await supabaseServer
      .from("members")
      .select("user_api_id, event_approved_count, event_checked_in_count")
      .in("user_api_id", ids);
    expect(beforeErr).toBeNull();
    const snapshot = new Map<
      string,
      { approved: number; checked_in: number }
    >();
    for (const r of before ?? []) {
      snapshot.set(r.user_api_id as string, {
        approved: r.event_approved_count as number,
        checked_in: r.event_checked_in_count as number,
      });
    }

    const result = await runImport(
      "test-5_stale.csv",
      resolve(FIXTURES_DIR, "5_stale_counts.csv"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data: after, error: afterErr } = await supabaseServer
      .from("members")
      .select("user_api_id, event_approved_count, event_checked_in_count")
      .in("user_api_id", ids);
    expect(afterErr).toBeNull();

    for (const r of after ?? []) {
      const prev = snapshot.get(r.user_api_id as string);
      expect(prev).toBeDefined();
      if (!prev) continue;
      expect(r.event_approved_count).toBeGreaterThanOrEqual(prev.approved);
      expect(r.event_checked_in_count).toBeGreaterThanOrEqual(prev.checked_in);
    }

    // Snapshot counts were all >= 0 (the stale CSV values), so expect all 10 unchanged.
    expect(result.new_count).toBe(0);
    expect(result.updated_count).toBe(0);
    expect(result.unchanged_count).toBe(10);
  }, 60_000);

  it("7. dry run does not modify members or member_edits", async () => {
    const { count: importsLiveBefore } = await supabaseServer
      .from("luma_imports")
      .select("*", { count: "exact", head: true })
      .like("filename", "test-%")
      .eq("dry_run", false);
    const { count: membersBefore } = await supabaseServer
      .from("members")
      .select("*", { count: "exact", head: true })
      .like("user_api_id", "usr-0%");
    const { count: editsBefore } = await supabaseServer
      .from("member_edits")
      .select("*", { count: "exact", head: true })
      .like("member_user_api_id", "usr-0%");

    const result = await runImport(
      "test-7_dryrun.csv",
      resolve(FIXTURES_DIR, "1_base.csv"),
      true,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dry_run).toBe(true);
    expect(
      result.new_count + result.updated_count + result.unchanged_count,
    ).toBeGreaterThan(0);

    const { count: importsLiveAfter } = await supabaseServer
      .from("luma_imports")
      .select("*", { count: "exact", head: true })
      .like("filename", "test-%")
      .eq("dry_run", false);
    const { count: membersAfter } = await supabaseServer
      .from("members")
      .select("*", { count: "exact", head: true })
      .like("user_api_id", "usr-0%");
    const { count: editsAfter } = await supabaseServer
      .from("member_edits")
      .select("*", { count: "exact", head: true })
      .like("member_user_api_id", "usr-0%");

    expect(importsLiveAfter).toBe(importsLiveBefore);
    expect(membersAfter).toBe(membersBefore);
    expect(editsAfter).toBe(editsBefore);
  }, 60_000);
});
