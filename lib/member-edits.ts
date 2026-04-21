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
