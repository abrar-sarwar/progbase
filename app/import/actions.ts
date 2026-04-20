"use server";

import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isAllowed } from "@/lib/allowlist";
import { parseLumaCsv, type ParseError } from "@/lib/csv";
import { revalidatePath } from "next/cache";

const MAX_BYTES = 10 * 1024 * 1024;

export type ImportResult = {
  ok: boolean;
  newCount: number;
  updatedCount: number;
  blockedCount: number;
  errorCount: number;
  rowCount: number;
  errors: ParseError[];
  missing?: string[];
  message?: string;
};

async function requireEditorEmail(): Promise<string> {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Not signed in");
  const email = (sessionClaims?.email as string | undefined) ?? null;
  if (!isAllowed(email, process.env.ALLOWED_EMAILS)) {
    throw new Error("Not authorized");
  }
  return email!.trim().toLowerCase();
}

function storagePath(): string {
  const now = new Date();
  const stamp =
    now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14) +
    "-" +
    Math.random().toString(36).slice(2, 10);
  return `${stamp}.csv`;
}

function emptyResult(overrides: Partial<ImportResult>): ImportResult {
  return {
    ok: false,
    newCount: 0,
    updatedCount: 0,
    blockedCount: 0,
    errorCount: 0,
    rowCount: 0,
    errors: [],
    ...overrides,
  };
}

export async function importCsv(formData: FormData): Promise<ImportResult> {
  const editor = await requireEditorEmail();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return emptyResult({ ok: false, message: "No file provided" });
  }
  if (file.size === 0) {
    return emptyResult({ ok: false, message: "File is empty" });
  }
  if (file.size > MAX_BYTES) {
    return emptyResult({ ok: false, message: "File exceeds 10 MB limit" });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseLumaCsv(buffer);

  if (!parsed.ok) {
    return emptyResult({
      ok: false,
      message: `Missing required columns: ${parsed.missing.join(", ")}`,
      missing: parsed.missing,
    });
  }

  const path = storagePath();
  const { error: upErr } = await supabaseServer.storage
    .from("luma-csv")
    .upload(path, buffer, { contentType: "text/csv" });
  if (upErr) {
    return emptyResult({
      ok: false,
      message: `Storage upload failed: ${upErr.message}`,
    });
  }

  // Blacklist: the table is small (handful of banned emails) so fetch it
  // entirely and build a local Set. Avoids URL-length errors that happen
  // when we pass hundreds of emails through .in() in a GET query string.
  const blockedSet = new Set<string>();
  {
    const { data: blRows, error: blErr } = await supabaseServer
      .from("blacklist")
      .select("email");
    if (blErr) {
      console.error("[importCsv] blacklist select failed:", blErr);
      return emptyResult({
        ok: false,
        message: `Blacklist check failed: ${blErr.message}`,
      });
    }
    for (const r of blRows ?? [])
      blockedSet.add((r.email as string).trim().toLowerCase());
  }

  const toUpsert: typeof parsed.rows = [];
  let blockedCount = 0;
  for (const r of parsed.rows) {
    const k = (r.email ?? "").trim().toLowerCase();
    if (k && blockedSet.has(k)) {
      blockedCount++;
      continue;
    }
    toUpsert.push(r);
  }

  let newCount = 0;
  let updatedCount = 0;
  if (toUpsert.length > 0) {
    const ids = toUpsert.map((r) => r.user_api_id);

    // Chunk the existing-ids check to keep each GET query string under the
    // PostgREST URL-length limit (empirically safe at 200/chunk).
    const CHUNK = 200;
    const existingIds = new Set<string>();
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { data: existingRows, error: selErr } = await supabaseServer
        .from("members")
        .select("user_api_id")
        .in("user_api_id", chunk);
      if (selErr) {
        console.error("[importCsv] existing-row select failed:", selErr);
        return emptyResult({
          ok: false,
          message: `Existing-row check failed: ${selErr.message}`,
        });
      }
      for (const r of existingRows ?? [])
        existingIds.add(r.user_api_id as string);
    }
    for (const r of toUpsert) {
      if (existingIds.has(r.user_api_id)) updatedCount++;
      else newCount++;
    }

    const { error: upsertErr } = await supabaseServer
      .from("members")
      .upsert(toUpsert, { onConflict: "user_api_id" });
    if (upsertErr) {
      console.error("[importCsv] upsert failed:", upsertErr);
      return emptyResult({
        ok: false,
        message: `Upsert failed: ${upsertErr.message}`,
      });
    }
  }

  const errorCount = parsed.errors.length;
  const status: "success" | "partial" | "failed" =
    errorCount === 0
      ? "success"
      : newCount + updatedCount > 0
        ? "partial"
        : "failed";

  const { error: logErr } = await supabaseServer.from("luma_imports").insert({
    uploaded_by: editor,
    storage_path: path,
    row_count: parsed.rows.length,
    new_count: newCount,
    updated_count: updatedCount,
    blocked_count: blockedCount,
    error_count: errorCount,
    status,
  });
  if (logErr) {
    return {
      ok: false,
      newCount,
      updatedCount,
      blockedCount,
      errorCount,
      rowCount: parsed.rows.length,
      errors: parsed.errors,
      message: `Import succeeded but logging failed: ${logErr.message}`,
    };
  }

  revalidatePath("/");
  revalidatePath("/analytics");
  revalidatePath("/import");

  return {
    ok: true,
    newCount,
    updatedCount,
    blockedCount,
    errorCount,
    rowCount: parsed.rows.length,
    errors: parsed.errors,
  };
}
