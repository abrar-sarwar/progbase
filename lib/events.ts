import "server-only";
import { supabaseServer } from "./supabase-server";
import type {
  Event,
  EventAttendance,
  EventAttendanceWithMember,
  Member,
} from "./types";

export async function listEventsTimeline(): Promise<Event[]> {
  const { data, error } = await supabaseServer
    .from("events")
    .select("*")
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("first_imported_at", { ascending: false });
  if (error) throw new Error(`Failed to list events: ${error.message}`);
  return (data as Event[]) ?? [];
}

export async function getEvent(lumaEventId: string): Promise<Event | null> {
  const { data, error } = await supabaseServer
    .from("events")
    .select("*")
    .eq("luma_event_id", lumaEventId)
    .maybeSingle();
  if (error) throw new Error(`Failed to get event: ${error.message}`);
  return (data as Event) ?? null;
}

export async function listEventAttendance(
  lumaEventId: string,
): Promise<EventAttendanceWithMember[]> {
  const { data: attendance, error: aErr } = await supabaseServer
    .from("event_attendance")
    .select("*")
    .eq("luma_event_id", lumaEventId);
  if (aErr) throw new Error(`Failed to list attendance: ${aErr.message}`);
  const rows = (attendance as EventAttendance[]) ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.member_user_api_id);
  const { data: members, error: mErr } = await supabaseServer
    .from("members")
    .select("user_api_id, name, email, major, grad_year")
    .in("user_api_id", ids);
  if (mErr) throw new Error(`Failed to load members: ${mErr.message}`);
  const byId = new Map<
    string,
    Pick<Member, "user_api_id" | "name" | "email" | "major" | "grad_year">
  >();
  for (const m of members ?? []) {
    const row = m as Pick<
      Member,
      "user_api_id" | "name" | "email" | "major" | "grad_year"
    >;
    byId.set(row.user_api_id, row);
  }
  return rows.map((r) => ({
    ...r,
    member: byId.get(r.member_user_api_id) ?? {
      user_api_id: r.member_user_api_id,
      name: null,
      email: null,
      major: null,
      grad_year: null,
    },
  }));
}

export async function listMemberEventHistory(
  memberUserApiId: string,
): Promise<
  Array<{
    luma_event_id: string;
    name: string;
    event_date: string | null;
    approval_status: EventAttendance["approval_status"];
    checked_in_at: string | null;
  }>
> {
  const { data, error } = await supabaseServer
    .from("event_attendance")
    .select(
      "luma_event_id, approval_status, checked_in_at, events(name, event_date)",
    )
    .eq("member_user_api_id", memberUserApiId);
  if (error) {
    throw new Error(`Failed to list member event history: ${error.message}`);
  }
  type JoinedRow = {
    luma_event_id: string;
    approval_status: EventAttendance["approval_status"];
    checked_in_at: string | null;
    events:
      | { name: string | null; event_date: string | null }
      | { name: string | null; event_date: string | null }[]
      | null;
  };
  const mapped = ((data as JoinedRow[]) ?? []).map((r) => {
    const ev = Array.isArray(r.events) ? r.events[0] ?? null : r.events;
    return {
      luma_event_id: r.luma_event_id,
      name: ev?.name ?? "Untitled event",
      event_date: ev?.event_date ?? null,
      approval_status: r.approval_status,
      checked_in_at: r.checked_in_at,
    };
  });
  // Sort newest first; nulls sink to the bottom.
  mapped.sort((a, b) => {
    if (a.event_date === b.event_date) return 0;
    if (a.event_date === null) return 1;
    if (b.event_date === null) return -1;
    return a.event_date < b.event_date ? 1 : -1;
  });
  return mapped;
}
