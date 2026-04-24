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
import { detectFormat } from "@/lib/csv-format";
import {
  parseEventRow,
  eventUnmappedHeaders,
  type EventAttendanceRow,
} from "@/lib/csv-event-row";
import { importEvent } from "@/lib/event-import";
import { revalidatePath } from "next/cache";
import Papa from "papaparse";

const MAX_BYTES = 10 * 1024 * 1024;

export type ImportError = { row: number; reason: string; email?: string };

/**
 * Per-file result for the multi-file batch action.
 */
export type PerFileResult =
  | {
      ok: true;
      filename: string;
      source_type: "subscribed" | "event";
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
      // Event-CSV only fields.
      luma_event_id?: string;
      luma_event_name?: string;
      replacing?: boolean;
      registered_count?: number;
      checked_in_count?: number;
    }
  | {
      ok: false;
      filename: string;
      message: string;
      missing_required?: string[];
    };

export type ImportBatchResult = {
  batch_id: string;
  files: PerFileResult[];
};

export type DispatchArgs = {
  filename: string;
  text: string;
  /**
   * Raw file bytes for storage upload. Optional so `dispatchOne` tests can
   * pass only `text` without constructing a Buffer; the real pipeline
   * always supplies it and the handlers fall back to `Buffer.from(text)`
   * only when absent.
   */
  buffer?: Buffer;
  fileSize?: number;
  override: "auto" | "subscribed" | "event";
  dryRun: boolean;
  batchId: string;
  editor: string;
  blockedEmails: Set<string>;
};

export type DispatchHandlers = {
  subscribed: (args: DispatchArgs) => Promise<PerFileResult>;
  event: (args: DispatchArgs) => Promise<PerFileResult>;
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

async function readFile(file: File): Promise<{ text: string; buffer: Buffer }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  let text = buffer.toString("utf-8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return { text, buffer };
}

function parseHeadersOnly(text: string): string[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    preview: 1,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h,
  });
  return parsed.meta.fields ?? [];
}

/**
 * Pure-ish dispatch loop. Decides whether a file is a subscribed or event CSV
 * (or unknown) and calls the matching handler. No Supabase, no auth — just
 * headers → format → handler. Exported so the orchestration can be unit-tested
 * against vi.fn() stubs without dragging in the full pipelines.
 */
export async function dispatchOne(
  args: DispatchArgs,
  handlers: DispatchHandlers,
): Promise<PerFileResult> {
  const headers = parseHeadersOnly(args.text);
  const detected = detectFormat(headers);
  const chosen =
    args.override === "subscribed" || args.override === "event"
      ? args.override
      : detected;
  if (chosen === "event") return handlers.event(args);
  if (chosen === "subscribed") return handlers.subscribed(args);
  return {
    ok: false,
    filename: args.filename,
    message:
      "Could not detect CSV format. Expected Luma calendar-subscribed or event guest export.",
  };
}

/**
 * Subscribed-CSV pipeline (classic Luma calendar-subscribed export).
 *
 * The input is pre-read `text` + raw `buffer` — the caller did the file
 * read, BOM-strip, and size/extension guards. Side effects: storage upload
 * (skipped on dry-run), `luma_imports` insert, `members` upsert, `member_edits`
 * insert. Blacklist is passed in (loaded once per batch).
 */
async function runSubscribedImport(args: {
  text: string;
  buffer: Buffer;
  filename: string;
  fileSize: number;
  editor: string;
  dryRun: boolean;
  batchId: string;
  blockedEmails: Set<string>;
}): Promise<PerFileResult> {
  const {
    text,
    buffer,
    filename,
    fileSize,
    editor,
    dryRun,
    batchId,
    blockedEmails,
  } = args;

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
      filename,
      message: `Missing required column(s): ${missingRequired.join(", ")}`,
      missing_required: missingRequired,
    };
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
    if (emailKey && blockedEmails.has(emailKey)) {
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
          filename,
          message: `Existing-row check failed: ${error.message}`,
        };
      }
      for (const r of data ?? [])
        existingMap.set(
          (r as { user_api_id: string }).user_api_id,
          r as Record<string, unknown>,
        );
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
      return {
        ok: false,
        filename,
        message: `Storage upload failed: ${upErr.message}`,
      };
    }
  }

  // Insert luma_imports row up-front so we have an id to reference from
  // member_edits. Leave counts null; patch at the end.
  const { data: imp, error: impErr } = await supabaseServer
    .from("luma_imports")
    .insert({
      uploaded_by: editor,
      storage_path: storage,
      filename,
      file_size_bytes: fileSize,
      row_count: parsed.data.length,
      status: "success",
      header_mapping: mapping,
      unmapped_headers: unmapped,
      dry_run: dryRun,
      source_type: "subscribed",
      batch_id: batchId,
    })
    .select("id")
    .single();
  if (impErr || !imp) {
    if (!dryRun) {
      // Best-effort cleanup: if we uploaded the CSV above and couldn't record
      // the import, delete the orphaned storage object so the bucket doesn't
      // collect unreferenced files over time.
      await supabaseServer.storage
        .from("luma-csv")
        .remove([storage])
        .catch(() => {});
    }
    return {
      ok: false,
      filename,
      message: `Import log failed: ${impErr?.message ?? "no id returned"}`,
    };
  }
  const importId = (imp as { id: string }).id;

  // NOTE: member upsert and member_edits insert are not atomic at the DB layer
  // (Supabase JS doesn't expose a transaction). If the upsert succeeds but the
  // audit insert fails, members are updated without an audit row. Acceptable
  // risk for this internal tool — on retry the classifier will see the
  // already-applied state as unchanged, so the missed audit rows stay missed.
  // Fixing properly would require a Postgres RPC with BEGIN/COMMIT.
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

    return {
      ok: true,
      filename,
      source_type: "subscribed",
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
    const finalErrors = [...errors, { row: 0, reason: msg } as ImportError];
    await supabaseServer
      .from("luma_imports")
      .update({
        error_count: finalErrors.length,
        errors: finalErrors,
        status: "failed",
      })
      .eq("id", importId);
    return {
      ok: false,
      filename,
      message: `Import failed: ${msg}`,
    };
  }
}

/**
 * Event-CSV pipeline (per-event guest export).
 *
 * Parses rows → delegates the DB writes to `importEvent`. Writes one
 * `luma_imports` row stamped `source_type='event'` with `luma_event_id`,
 * `luma_event_name`, `batch_id`, and `unmapped_headers`. Blacklist is
 * enforced by `importEvent` against the passed-in `blockedEmails` set.
 */
async function runEventImport(args: {
  text: string;
  buffer: Buffer;
  filename: string;
  fileSize: number;
  editor: string;
  dryRun: boolean;
  batchId: string;
  blockedEmails: Set<string>;
}): Promise<PerFileResult> {
  const {
    text,
    buffer,
    filename,
    fileSize,
    editor,
    dryRun,
    batchId,
    blockedEmails,
  } = args;

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h,
  });
  const rawHeaders = parsed.meta.fields ?? [];
  const unmapped = eventUnmappedHeaders(rawHeaders);

  const errors: ImportError[] = [];
  const goodRows: EventAttendanceRow[] = [];
  parsed.data.forEach((raw, idx) => {
    const rowNum = idx + 2;
    const res = parseEventRow(raw as Record<string, string | undefined>);
    if (!res.ok) {
      errors.push({ row: rowNum, reason: res.reason, email: res.email });
      return;
    }
    goodRows.push(res.row);
  });

  if (goodRows.length === 0) {
    // No attendance rows to import — log a failed row and bail. No storage
    // upload either, since nothing would be replayable.
    const { data: imp } = await supabaseServer
      .from("luma_imports")
      .insert({
        uploaded_by: editor,
        storage_path: "(no-rows)",
        filename,
        file_size_bytes: fileSize,
        row_count: parsed.data.length,
        status: "failed",
        header_mapping: {},
        unmapped_headers: unmapped,
        dry_run: dryRun,
        source_type: "event",
        batch_id: batchId,
        error_count: errors.length,
        errors,
        new_count: 0,
        updated_count: 0,
        unchanged_count: 0,
        blocked_count: 0,
      })
      .select("id")
      .single();
    return {
      ok: false,
      filename,
      message:
        errors.length > 0
          ? `No importable rows. First error: ${errors[0].reason}`
          : "No rows in event CSV",
      ...(imp ? {} : {}),
    };
  }

  // Enforce single-event per file. All good rows share a luma_event_id by
  // construction of the parser, but double-check to reject manually-merged
  // CSVs early (before the DB write) with a clear message.
  const luma_event_id = goodRows[0].luma_event_id;
  for (const r of goodRows) {
    if (r.luma_event_id !== luma_event_id) {
      return {
        ok: false,
        filename,
        message: `Event CSV rows span multiple events (${luma_event_id} vs ${r.luma_event_id}). Split into per-event files.`,
      };
    }
  }

  // Upload raw CSV for replay (skip on dry-run).
  const storage = dryRun ? "(dry-run)" : storagePath();
  if (!dryRun) {
    const { error: upErr } = await supabaseServer.storage
      .from("luma-csv")
      .upload(storage, buffer, { contentType: "text/csv" });
    if (upErr) {
      return {
        ok: false,
        filename,
        message: `Storage upload failed: ${upErr.message}`,
      };
    }
  }

  // Insert luma_imports row up-front so we have an id before the main write.
  const { data: imp, error: impErr } = await supabaseServer
    .from("luma_imports")
    .insert({
      uploaded_by: editor,
      storage_path: storage,
      filename,
      file_size_bytes: fileSize,
      row_count: parsed.data.length,
      status: "success",
      header_mapping: {},
      unmapped_headers: unmapped,
      dry_run: dryRun,
      source_type: "event",
      luma_event_id,
      batch_id: batchId,
    })
    .select("id")
    .single();
  if (impErr || !imp) {
    if (!dryRun) {
      await supabaseServer.storage
        .from("luma-csv")
        .remove([storage])
        .catch(() => {});
    }
    return {
      ok: false,
      filename,
      message: `Import log failed: ${impErr?.message ?? "no id returned"}`,
    };
  }
  const importId = (imp as { id: string }).id;

  try {
    if (dryRun) {
      // Dry-run for event CSVs: don't write event/attendance rows. Report
      // parse-level counts only. blocked_count is computed client-side since
      // importEvent wasn't called.
      let blockedCount = 0;
      for (const r of goodRows) if (blockedEmails.has(r.email)) blockedCount++;
      const nonBlocked = goodRows.filter((r) => !blockedEmails.has(r.email));
      const registered = nonBlocked.filter(
        (r) => r.approval_status !== "declined",
      ).length;
      const checkedIn = nonBlocked.filter(
        (r) => r.checked_in_at !== null,
      ).length;
      const errorCount = errors.length;

      await supabaseServer
        .from("luma_imports")
        .update({
          new_count: 0,
          updated_count: 0,
          unchanged_count: 0,
          blocked_count: blockedCount,
          error_count: errorCount,
          errors,
          status: errorCount === 0 ? "success" : "partial",
        })
        .eq("id", importId);

      return {
        ok: true,
        filename,
        source_type: "event",
        import_id: importId,
        dry_run: dryRun,
        new_count: 0,
        updated_count: 0,
        unchanged_count: 0,
        blocked_count: blockedCount,
        error_count: errorCount,
        unmapped_headers: unmapped,
        header_mapping: {},
        errors,
        luma_event_id,
        replacing: false,
        registered_count: registered,
        checked_in_count: checkedIn,
      };
    }

    const result = await importEvent({
      rows: goodRows,
      filename,
      blockedEmails,
    });

    const newCount = result.auto_created_members;
    const updatedCount = Math.max(
      0,
      result.touched_members - result.auto_created_members,
    );
    const unchangedCount = 0;
    const blockedCount = result.blocked_count;
    const errorCount = errors.length;
    const wroteAnything = result.touched_members > 0;
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
        luma_event_name: result.event_name,
      })
      .eq("id", importId);
    if (patchErr) {
      console.error("[importCsv] event counts patch failed:", patchErr);
    }

    return {
      ok: true,
      filename,
      source_type: "event",
      import_id: importId,
      dry_run: dryRun,
      new_count: newCount,
      updated_count: updatedCount,
      unchanged_count: unchangedCount,
      blocked_count: blockedCount,
      error_count: errorCount,
      unmapped_headers: unmapped,
      header_mapping: {},
      errors,
      luma_event_id: result.luma_event_id,
      luma_event_name: result.event_name,
      replacing: result.was_replacing,
      registered_count: result.registered,
      checked_in_count: result.checked_in,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const finalErrors = [...errors, { row: 0, reason: msg } as ImportError];
    await supabaseServer
      .from("luma_imports")
      .update({
        error_count: finalErrors.length,
        errors: finalErrors,
        status: "failed",
      })
      .eq("id", importId);
    return {
      ok: false,
      filename,
      message: `Event import failed: ${msg}`,
    };
  }
}

async function loadBlockedEmails(): Promise<Set<string>> {
  const blockedSet = new Set<string>();
  const { data: blRows, error: blErr } = await supabaseServer
    .from("blacklist")
    .select("email_normalized");
  if (blErr) throw new Error(`Blacklist check failed: ${blErr.message}`);
  for (const r of blRows ?? []) {
    const v = (r as { email_normalized: string | null }).email_normalized;
    if (v) blockedSet.add(v);
  }
  return blockedSet;
}

/**
 * Multi-file batch import. Generates one `batch_id`, loads the blacklist
 * once, walks every `file` entry in the FormData with its matching
 * `override_N` field, and dispatches each to the right pipeline via
 * `dispatchOne`. One file's failure does not abort the batch — it becomes a
 * `{ok:false,...}` entry and processing continues.
 */
export async function importCsvBatch(
  formData: FormData,
  dryRun: boolean = false,
): Promise<ImportBatchResult> {
  const editor = await requireEditorEmail();
  const batchId = crypto.randomUUID();

  const rawFiles = formData.getAll("file");
  const files = rawFiles.filter((f): f is File => f instanceof File);
  const overrides = files.map((_, i) => {
    const raw = String(formData.get(`override_${i}`) ?? "auto");
    return raw === "subscribed" || raw === "event" ? raw : "auto";
  });

  if (files.length === 0) {
    return {
      batch_id: batchId,
      files: [
        {
          ok: false,
          filename: "(no file)",
          message: "No file provided",
        },
      ],
    };
  }

  const blockedEmails = await loadBlockedEmails();

  const handlers: DispatchHandlers = {
    subscribed: async (a) => {
      const buffer = a.buffer ?? Buffer.from(a.text, "utf-8");
      return runSubscribedImport({
        text: a.text,
        buffer,
        filename: a.filename,
        fileSize: a.fileSize ?? buffer.byteLength,
        editor: a.editor,
        dryRun: a.dryRun,
        batchId: a.batchId,
        blockedEmails: a.blockedEmails,
      });
    },
    event: async (a) => {
      const buffer = a.buffer ?? Buffer.from(a.text, "utf-8");
      return runEventImport({
        text: a.text,
        buffer,
        filename: a.filename,
        fileSize: a.fileSize ?? buffer.byteLength,
        editor: a.editor,
        dryRun: a.dryRun,
        batchId: a.batchId,
        blockedEmails: a.blockedEmails,
      });
    },
  };

  const results: PerFileResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const override = overrides[i] as "auto" | "subscribed" | "event";

    // Per-file guards.
    if (!file.name.toLowerCase().endsWith(".csv")) {
      results.push({
        ok: false,
        filename: file.name,
        message: "Only .csv files are accepted",
      });
      continue;
    }
    if (file.size === 0) {
      results.push({
        ok: false,
        filename: file.name,
        message: "File is empty",
      });
      continue;
    }
    if (file.size > MAX_BYTES) {
      results.push({
        ok: false,
        filename: file.name,
        message: "File exceeds 10 MB limit",
      });
      continue;
    }

    try {
      const { text, buffer } = await readFile(file);
      const result = await dispatchOne(
        {
          filename: file.name,
          text,
          buffer,
          fileSize: file.size,
          override,
          dryRun,
          batchId,
          editor,
          blockedEmails,
        },
        handlers,
      );
      results.push(result);
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
