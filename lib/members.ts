import "server-only";
import { supabaseServer } from "./supabase-server";
import type { Member } from "./types";

export async function listVisibleMembers(): Promise<Member[]> {
  const { data, error } = await supabaseServer
    .from("members")
    .select("*")
    .eq("hidden", false)
    .order("event_checked_in_count", { ascending: false })
    .order("event_approved_count", { ascending: false })
    .order("first_seen", { ascending: true, nullsFirst: true });
  if (error) throw new Error(`Failed to list members: ${error.message}`);
  return (data as Member[]) ?? [];
}

export async function getMember(userApiId: string): Promise<Member | null> {
  const { data, error } = await supabaseServer
    .from("members")
    .select("*")
    .eq("user_api_id", userApiId)
    .maybeSingle();
  if (error) throw new Error(`Failed to get member: ${error.message}`);
  return (data as Member) ?? null;
}
