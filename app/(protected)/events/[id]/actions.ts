"use server";

import { auth } from "@/auth";
import { isAllowed } from "@/lib/allowlist";
import { supabaseServer } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function updateEventDate(
  lumaEventId: string,
  iso: string | null,
): Promise<void> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email || !isAllowed(email, process.env.ALLOWED_EMAILS)) {
    throw new Error("Not authorized");
  }
  let value: string | null = null;
  if (iso && iso.trim()) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) {
      throw new Error("Invalid date");
    }
    value = d.toISOString();
  }
  const { error } = await supabaseServer
    .from("events")
    .update({ event_date: value })
    .eq("luma_event_id", lumaEventId);
  if (error) throw new Error(error.message);
  revalidatePath("/events");
  revalidatePath(`/events/${encodeURIComponent(lumaEventId)}`);
}
