import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "./supabase-server";
import type { EventAttendanceRow } from "./csv-event-row";

export type ImportEventDeps = {
  db: Pick<SupabaseClient, "from">;
};

export type EventImportResult = {
  luma_event_id: string;
  event_name: string;
  event_date: string | null;
  was_replacing: boolean;
  registered: number;
  approved: number;
  checked_in: number;
  auto_created_members: number;
  touched_members: number;
  blocked_count: number;
};

function deriveEventDate(
  rows: Array<{
    checked_in_at: string | null;
    registered_at: string | null;
  }>,
): string | null {
  let maxCheckin: string | null = null;
  for (const r of rows) {
    if (r.checked_in_at && (!maxCheckin || r.checked_in_at > maxCheckin)) {
      maxCheckin = r.checked_in_at;
    }
  }
  if (maxCheckin) return maxCheckin;
  let maxRegistered: string | null = null;
  for (const r of rows) {
    if (r.registered_at && (!maxRegistered || r.registered_at > maxRegistered)) {
      maxRegistered = r.registered_at;
    }
  }
  return maxRegistered;
}

function eventNameFromFilename(filename: string | null): string {
  if (!filename) return "Untitled event";
  const base = filename.replace(/\.csv$/i, "").trim();
  return base.length ? base : "Untitled event";
}

export async function importEvent(
  args: {
    rows: EventAttendanceRow[];
    filename: string | null;
    blockedEmails: Set<string>;
  },
  deps?: ImportEventDeps,
): Promise<EventImportResult> {
  const { rows: allRows, filename, blockedEmails } = args;
  if (allRows.length === 0) throw new Error("importEvent: no rows to import");
  const db = deps?.db ?? supabaseServer;

  // All rows must share the same luma_event_id by construction (parser
  // extracts from qr_code_url, and the UI/server won't mix files).
  const luma_event_id = allRows[0].luma_event_id;
  for (const r of allRows) {
    if (r.luma_event_id !== luma_event_id) {
      throw new Error(
        `event CSV rows span multiple events: ${luma_event_id} vs ${r.luma_event_id}`,
      );
    }
  }

  // Filter blocked emails BEFORE auto-create and BEFORE attendance insert.
  // Blocked guests don't become members, don't appear in event_attendance,
  // and aren't counted in events.registered_count / approved_count /
  // checked_in_count — as if they weren't in the CSV at all.
  const rows = allRows.filter((r) => !blockedEmails.has(r.email));
  const blocked_count = allRows.length - rows.length;

  // 1. Is this event already in the DB? (So the UI can show "replacing".)
  const { data: existingEvent, error: evErr } = await db
    .from("events")
    .select("luma_event_id, name, event_date, first_imported_at")
    .eq("luma_event_id", luma_event_id)
    .maybeSingle();
  if (evErr) throw new Error(`event lookup failed: ${evErr.message}`);
  const wasReplacing = !!existingEvent;

  // 2. Match incoming emails against existing members.
  const emails = Array.from(new Set(rows.map((r) => r.email)));
  const memberByEmail = new Map<string, string>(); // email -> user_api_id
  const CHUNK = 200;
  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK);
    const { data, error } = await db
      .from("members")
      .select("user_api_id, email_normalized")
      .in("email_normalized", chunk);
    if (error) throw new Error(`member lookup failed: ${error.message}`);
    for (const m of data ?? []) {
      const em = (m as { email_normalized: string }).email_normalized;
      const id = (m as { user_api_id: string }).user_api_id;
      if (em) memberByEmail.set(em, id);
    }
  }

  // 3. Auto-create members for emails we've never seen. Dedupe by email —
  //    one person buying two tickets to the same event shows up as two rows
  //    with the same email but different api_ids, and we want exactly one
  //    member row per email.
  const toCreate: {
    user_api_id: string;
    name: string | null;
    email: string;
    first_seen: string | null;
    source: "event_only";
  }[] = [];
  const toCreateByEmail = new Map<string, number>(); // email -> index in toCreate
  for (const r of rows) {
    if (memberByEmail.has(r.email)) continue;
    if (!r.guest_api_id) continue; // Luma always sets api_id; defensive.
    const priorIdx = toCreateByEmail.get(r.email);
    if (priorIdx !== undefined) {
      // Already queued under a different guest id. Keep the first; if the
      // later row has a name and the first doesn't, upgrade.
      const prior = toCreate[priorIdx];
      if (!prior.name && r.name) prior.name = r.name;
      continue;
    }
    toCreateByEmail.set(r.email, toCreate.length);
    toCreate.push({
      user_api_id: r.guest_api_id,
      name: r.name,
      email: r.email,
      first_seen: r.registered_at,
      source: "event_only",
    });
  }
  if (toCreate.length > 0) {
    const { error: insErr } = await db
      .from("members")
      .upsert(toCreate, { onConflict: "user_api_id" });
    if (insErr) throw new Error(`auto-create members failed: ${insErr.message}`);
    for (const c of toCreate) memberByEmail.set(c.email, c.user_api_id);
  }

  // 4. Dedupe attendance rows by (event, member). Same person with two
  //    tickets to the same event collapses; we keep the row with the best
  //    check-in/registration signal. We compute this BEFORE the event
  //    upsert so the stored event counts match the attendance rows we
  //    actually insert.
  type Attn = {
    luma_event_id: string;
    member_user_api_id: string;
    guest_api_id: string | null;
    approval_status: EventAttendanceRow["approval_status"];
    registered_at: string | null;
    checked_in_at: string | null;
  };
  const byMember = new Map<string, Attn>();
  for (const r of rows) {
    const memberId = memberByEmail.get(r.email);
    if (!memberId) continue; // rows with no api_id and no existing member fall here
    const prev = byMember.get(memberId);
    const candidate: Attn = {
      luma_event_id,
      member_user_api_id: memberId,
      guest_api_id: r.guest_api_id,
      approval_status: r.approval_status,
      registered_at: r.registered_at,
      checked_in_at: r.checked_in_at,
    };
    if (!prev) {
      byMember.set(memberId, candidate);
      continue;
    }
    const prevScore =
      (prev.checked_in_at ? 2 : 0) + (prev.registered_at ? 1 : 0);
    const nextScore =
      (candidate.checked_in_at ? 2 : 0) + (candidate.registered_at ? 1 : 0);
    if (nextScore > prevScore) byMember.set(memberId, candidate);
  }
  const attnRows = Array.from(byMember.values());

  // Counts are computed from attnRows — the exact set that lands in
  // event_attendance — so events.registered_count never drifts from the
  // row count the detail page recomputes.
  const derivedDate = deriveEventDate(attnRows);
  const registered = attnRows.filter(
    (a) => a.approval_status !== "declined",
  ).length;
  const approved = attnRows.filter(
    (a) => a.approval_status === "approved",
  ).length;
  const checkedIn = attnRows.filter((a) => a.checked_in_at !== null).length;

  // 5. Upsert the event row. Do NOT clobber a human-edited event_date on
  //    re-import (only set on first import or when event_date is null).
  const eventName = existingEvent?.name ?? eventNameFromFilename(filename);
  const eventUpsert: Record<string, unknown> = {
    luma_event_id,
    name: eventName,
    last_imported_at: new Date().toISOString(),
    registered_count: registered,
    approved_count: approved,
    checked_in_count: checkedIn,
  };
  if (!existingEvent) {
    eventUpsert.event_date = derivedDate;
    eventUpsert.first_imported_at = new Date().toISOString();
  } else if (existingEvent.event_date === null) {
    eventUpsert.event_date = derivedDate;
  }

  const { error: upEvErr } = await db
    .from("events")
    .upsert(eventUpsert, { onConflict: "luma_event_id" });
  if (upEvErr) throw new Error(`event upsert failed: ${upEvErr.message}`);

  // 6. Delete existing attendance for this event, then insert fresh.
  const { error: delErr } = await db
    .from("event_attendance")
    .delete()
    .eq("luma_event_id", luma_event_id);
  if (delErr) throw new Error(`attendance clear failed: ${delErr.message}`);

  if (attnRows.length > 0) {
    for (let i = 0; i < attnRows.length; i += 500) {
      const chunk = attnRows.slice(i, i + 500);
      const { error: insAttnErr } = await db
        .from("event_attendance")
        .insert(chunk);
      if (insAttnErr) {
        throw new Error(`attendance insert failed: ${insAttnErr.message}`);
      }
    }
  }

  // 7. Recompute members.event_approved_count and event_checked_in_count
  //    for every member we just touched.
  const touched = Array.from(byMember.keys());
  await recomputeMemberCounters(touched, deps);

  return {
    luma_event_id,
    event_name: eventName,
    event_date: derivedDate,
    was_replacing: wasReplacing,
    registered,
    approved,
    checked_in: checkedIn,
    auto_created_members: toCreate.length,
    touched_members: touched.length,
    blocked_count,
  };
}

// Known limits of this recompute strategy. The bound is members-touched-per-
// import x 2 round-trips (read-aggregate + per-member-update). For the
// largest realistic import (~419 guests, one event) that is ~840 DB calls,
// completing well under the server action's time budget. If a single import
// ever touches more than ~2000 distinct member rows, reconsider switching
// to a Postgres RPC that runs
//   UPDATE members ... FROM (
//     SELECT member_user_api_id,
//            count(*) filter (where approval_status='approved') ...
//     FROM event_attendance GROUP BY ...
//   )
// in one statement.
export async function recomputeMemberCounters(
  memberIds: string[],
  deps?: ImportEventDeps,
): Promise<void> {
  if (memberIds.length === 0) return;
  const db = deps?.db ?? supabaseServer;
  // Pull aggregates from event_attendance, then patch members row-by-row
  // in chunks. Supabase JS doesn't expose a raw UPDATE FROM (SELECT…) so
  // we do it client-side. One query per chunk, not one per member.
  const CHUNK = 200;
  for (let i = 0; i < memberIds.length; i += CHUNK) {
    const chunk = memberIds.slice(i, i + CHUNK);
    const { data, error } = await db
      .from("event_attendance")
      .select("member_user_api_id, approval_status, checked_in_at")
      .in("member_user_api_id", chunk);
    if (error) {
      throw new Error(`counter recompute read failed: ${error.message}`);
    }
    const counts = new Map<
      string,
      { approved: number; checked_in: number }
    >();
    for (const id of chunk) counts.set(id, { approved: 0, checked_in: 0 });
    for (const r of data ?? []) {
      const rec = r as {
        member_user_api_id: string;
        approval_status: EventAttendanceRow["approval_status"];
        checked_in_at: string | null;
      };
      const acc = counts.get(rec.member_user_api_id);
      if (!acc) continue;
      if (rec.approval_status === "approved") acc.approved++;
      if (rec.checked_in_at) acc.checked_in++;
    }
    // Write them back. supabase-js doesn't support bulk UPDATE with
    // different values per row, so we issue one UPDATE per member in the
    // chunk. Chunks are bounded by 200 → at most 17 × 419 touches in the
    // largest realistic batch; well within request budgets.
    for (const [id, c] of counts) {
      const { error: upErr } = await db
        .from("members")
        .update({
          event_approved_count: c.approved,
          event_checked_in_count: c.checked_in,
        })
        .eq("user_api_id", id);
      if (upErr) {
        throw new Error(`counter recompute write failed: ${upErr.message}`);
      }
    }
  }
}
