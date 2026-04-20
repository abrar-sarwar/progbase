"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// IMPORTANT: this client uses the publishable anon key and is intended
// ONLY for Realtime channels (presence / broadcast). Do NOT use it for
// reading or writing member data — all DB access stays server-side via
// the service-role client in lib/supabase-server.ts.

let client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return client;
}
