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
