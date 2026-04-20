"use server";

import { auth } from "@/auth";
import { supabaseServer } from "@/lib/supabase-server";
import { isAllowed } from "@/lib/allowlist";
import { revalidatePath } from "next/cache";

async function requireEditorEmail(): Promise<string> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) throw new Error("Not signed in");
  if (!isAllowed(email, process.env.ALLOWED_EMAILS)) {
    throw new Error("Not authorized");
  }
  return email.trim().toLowerCase();
}

export async function addBlacklist(input: {
  email: string;
  name?: string;
  reason: string;
}): Promise<void> {
  let editor: string;
  try {
    editor = await requireEditorEmail();
  } catch (e) {
    console.error("[addBlacklist] auth failed:", e);
    throw e;
  }
  const email = input.email.trim().toLowerCase();
  const reason = input.reason.trim();
  if (!email) throw new Error("Email required");
  if (!reason) throw new Error("Reason required");

  const { error } = await supabaseServer.from("blacklist").upsert(
    {
      email,
      name: input.name?.trim() || null,
      reason,
      added_by: editor,
    },
    { onConflict: "email" },
  );
  if (error) {
    console.error("[addBlacklist] upsert failed:", error);
    throw new Error(`Add to blacklist failed: ${error.message}`);
  }

  const { data: matching, error: selErr } = await supabaseServer
    .from("members")
    .select("user_api_id, hidden")
    .ilike("email", email);
  if (selErr) {
    console.error("[addBlacklist] matching-members select failed:", selErr);
    throw new Error(`Member lookup failed: ${selErr.message}`);
  }

  const toHide = (matching ?? []).filter((m) => !m.hidden);
  if (toHide.length > 0) {
    const ids = toHide.map((m) => m.user_api_id as string);
    const { error: hideErr } = await supabaseServer
      .from("members")
      .update({
        hidden: true,
        updated_at: new Date().toISOString(),
        updated_by: editor,
      })
      .in("user_api_id", ids);
    if (hideErr) {
      console.error("[addBlacklist] hide failed:", hideErr);
      throw new Error(`Hide members failed: ${hideErr.message}`);
    }

    const { error: logErr } = await supabaseServer.from("member_edits").insert(
      ids.map((id) => ({
        member_user_api_id: id,
        editor_email: editor,
        field: "hidden",
        old_value: "false",
        new_value: "true",
      })),
    );
    if (logErr) {
      console.error("[addBlacklist] audit log failed:", logErr);
      throw new Error(`Audit log failed: ${logErr.message}`);
    }
  }

  revalidatePath("/blacklist");
  revalidatePath("/");
}

export async function removeBlacklist(
  email: string,
  alsoUnhide: boolean,
): Promise<void> {
  const editor = await requireEditorEmail();
  const e = email.trim().toLowerCase();

  const { error: delErr } = await supabaseServer
    .from("blacklist")
    .delete()
    .eq("email", e);
  if (delErr) throw new Error(delErr.message);

  if (alsoUnhide) {
    const { error: uhErr } = await supabaseServer
      .from("members")
      .update({
        hidden: false,
        updated_at: new Date().toISOString(),
        updated_by: editor,
      })
      .ilike("email", e);
    if (uhErr) throw new Error(uhErr.message);
  }

  revalidatePath("/blacklist");
  revalidatePath("/");
}
