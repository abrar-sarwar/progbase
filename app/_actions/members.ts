"use server";

import { auth } from "@/auth";
import { supabaseServer } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { isAllowed } from "@/lib/allowlist";

const EDITABLE_FIELDS = [
  "description",
  "major",
  "grad_year",
  "gender",
  "pronouns",
  "linkedin_url",
  "custom_tags",
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

async function requireEditorEmail(): Promise<string> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) throw new Error("Not signed in");
  if (!isAllowed(email, process.env.ALLOWED_EMAILS)) {
    throw new Error("Not authorized");
  }
  return email.trim().toLowerCase();
}

function normalize(field: EditableField, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (field === "custom_tags") {
    if (!Array.isArray(value)) return null;
    const cleaned = value
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    return cleaned.length ? cleaned : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toDisplay(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

export async function updateMember(
  userApiId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const editor = await requireEditorEmail();

  const { data: existing, error: fetchErr } = await supabaseServer
    .from("members")
    .select("*")
    .eq("user_api_id", userApiId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!existing) throw new Error("Member not found");
  if (existing.hidden) {
    const blocker = existing.updated_by ?? "a VP";
    throw new Error(
      `This member was blocked by ${blocker}. Unblock from /blacklist to edit.`,
    );
  }

  const cleanPatch: Record<string, unknown> = {};
  const edits: {
    field: string;
    old_value: string | null;
    new_value: string | null;
  }[] = [];

  for (const field of EDITABLE_FIELDS) {
    if (!(field in patch)) continue;
    const next = normalize(field, patch[field]);
    const prev = existing[field];
    const prevNorm = normalize(field, prev);
    if (JSON.stringify(next) === JSON.stringify(prevNorm)) continue;
    cleanPatch[field] = next;
    edits.push({
      field,
      old_value: toDisplay(prevNorm),
      new_value: toDisplay(next),
    });
  }

  if (Object.keys(cleanPatch).length === 0) return;

  cleanPatch.updated_at = new Date().toISOString();
  cleanPatch.updated_by = editor;

  const { error: updErr } = await supabaseServer
    .from("members")
    .update(cleanPatch)
    .eq("user_api_id", userApiId);
  if (updErr) throw new Error(updErr.message);

  if (edits.length > 0) {
    const { error: logErr } = await supabaseServer.from("member_edits").insert(
      edits.map((e) => ({
        member_user_api_id: userApiId,
        editor_email: editor,
        field: e.field,
        old_value: e.old_value,
        new_value: e.new_value,
      })),
    );
    if (logErr) throw new Error(logErr.message);
  }

  revalidatePath("/");
  revalidatePath(`/members/${encodeURIComponent(userApiId)}`);
}

export async function blockMember(
  userApiId: string,
  reason: string,
): Promise<void> {
  const editor = await requireEditorEmail();
  if (!reason.trim()) throw new Error("Reason required");

  const { data: existing, error: fetchErr } = await supabaseServer
    .from("members")
    .select("user_api_id, name, email, hidden")
    .eq("user_api_id", userApiId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!existing) throw new Error("Member not found");
  if (!existing.email) throw new Error("Cannot block a member with no email");

  const emailKey = existing.email.trim().toLowerCase();

  const { error: blErr } = await supabaseServer.from("blacklist").upsert(
    {
      email: emailKey,
      name: existing.name,
      reason: reason.trim(),
      added_by: editor,
    },
    { onConflict: "email" },
  );
  if (blErr) throw new Error(blErr.message);

  const wasHidden = existing.hidden;
  const { error: updErr } = await supabaseServer
    .from("members")
    .update({
      hidden: true,
      updated_at: new Date().toISOString(),
      updated_by: editor,
    })
    .eq("user_api_id", userApiId);
  if (updErr) throw new Error(updErr.message);

  if (!wasHidden) {
    const { error: logErr } = await supabaseServer.from("member_edits").insert({
      member_user_api_id: userApiId,
      editor_email: editor,
      field: "hidden",
      old_value: "false",
      new_value: "true",
    });
    if (logErr) throw new Error(logErr.message);
  }

  revalidatePath("/");
  revalidatePath("/blacklist");
}
