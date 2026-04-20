"use server";

import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isAllowed } from "@/lib/allowlist";
import { revalidatePath } from "next/cache";

async function requireEditorEmail(): Promise<string> {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Not signed in");
  const email = (sessionClaims?.email as string | undefined) ?? null;
  if (!isAllowed(email, process.env.ALLOWED_EMAILS)) {
    throw new Error("Not authorized");
  }
  return email!.trim().toLowerCase();
}

export async function addEboardEntry(input: {
  label: string;
  email?: string;
  name?: string;
}): Promise<void> {
  const editor = await requireEditorEmail();
  const label = input.label.trim();
  const email = input.email?.trim().toLowerCase() || null;
  const name = input.name?.trim().toLowerCase() || null;

  if (!label) throw new Error("Label required");
  if (!email && !name) {
    throw new Error("Provide at least one of email or name");
  }
  if (email && !email.includes("@")) {
    throw new Error("Email must contain an @");
  }

  const { error } = await supabaseServer.from("eboard_entries").insert({
    label,
    email,
    name,
    added_by: editor,
  });

  if (error) {
    console.error("[addEboardEntry] insert failed:", error);
    if (error.code === "42P01") {
      throw new Error(
        "The eboard_entries table doesn't exist yet. Run the migration SQL from README first.",
      );
    }
    if (error.code === "23505") {
      throw new Error("An entry with this email already exists");
    }
    throw new Error(`Add failed: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/eboard");
}

export async function removeEboardEntry(id: string): Promise<void> {
  await requireEditorEmail();
  const { error } = await supabaseServer
    .from("eboard_entries")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[removeEboardEntry] delete failed:", error);
    throw new Error(`Remove failed: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/eboard");
}
