import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Importing `app/(protected)/import/actions` pulls in `@/auth`, which in turn
// loads NextAuth + `next/server`. That import chain fails under vitest's Node
// resolver. `dispatchOne` doesn't actually call `auth()` — the call happens in
// `importCsvBatch`, which these tests don't exercise — so we stub the module
// out at the boundary. Same reason we stub `@/lib/supabase-server`: the full
// actions module pulls it in at load time even though `dispatchOne` never
// touches it.
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => null),
}));
vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: {},
}));

import { dispatchOne } from "../app/(protected)/import/actions";

const eventCsv = readFileSync(
  path.join(__dirname, "fixtures", "6_event_guests.csv"),
  "utf-8",
);
const subscribedCsv = readFileSync(
  path.join(__dirname, "fixtures", "1_base.csv"),
  "utf-8",
);

function baseArgs(overrides: Partial<Parameters<typeof dispatchOne>[0]> = {}) {
  return {
    filename: "test.csv",
    text: "",
    override: "auto" as const,
    dryRun: false,
    batchId: "batch-test",
    editor: "editor@example.com",
    blockedEmails: new Set<string>(),
    ...overrides,
  };
}

describe("dispatchOne", () => {
  it("routes event CSVs to the event handler", async () => {
    const event = vi.fn(
      async () =>
        ({
          ok: true,
          filename: "e.csv",
          source_type: "event",
        }) as any,
    );
    const subscribed = vi.fn(
      async () => ({ ok: true, filename: "e.csv" }) as any,
    );

    const res = await dispatchOne(
      baseArgs({ filename: "e.csv", text: eventCsv }),
      { event, subscribed },
    );

    expect(event).toHaveBeenCalledTimes(1);
    expect(subscribed).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });

  it("routes subscribed CSVs to the subscribed handler", async () => {
    const event = vi.fn(
      async () => ({ ok: true, filename: "s.csv" }) as any,
    );
    const subscribed = vi.fn(
      async () =>
        ({
          ok: true,
          filename: "s.csv",
          source_type: "subscribed",
        }) as any,
    );

    const res = await dispatchOne(
      baseArgs({ filename: "s.csv", text: subscribedCsv }),
      { event, subscribed },
    );

    expect(subscribed).toHaveBeenCalledTimes(1);
    expect(event).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });

  it("honors an explicit override (subscribed beats auto-detect)", async () => {
    const event = vi.fn(
      async () => ({ ok: true, filename: "x.csv" }) as any,
    );
    const subscribed = vi.fn(
      async () => ({ ok: true, filename: "x.csv" }) as any,
    );

    // eventCsv auto-detects as "event", but override forces "subscribed".
    await dispatchOne(
      baseArgs({ filename: "x.csv", text: eventCsv, override: "subscribed" }),
      { event, subscribed },
    );

    expect(subscribed).toHaveBeenCalledTimes(1);
    expect(event).not.toHaveBeenCalled();
  });

  it("returns the unknown-format error for garbage headers", async () => {
    const event = vi.fn();
    const subscribed = vi.fn();

    const res = await dispatchOne(
      baseArgs({ filename: "junk.csv", text: "foo,bar\n1,2\n" }),
      { event, subscribed },
    );

    expect(event).not.toHaveBeenCalled();
    expect(subscribed).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    if (res.ok) return; // type narrowing
    expect(res.filename).toBe("junk.csv");
    expect(res.message).toMatch(/Could not detect/);
  });
});
