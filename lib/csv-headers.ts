export type CanonicalField =
  | "user_api_id"
  | "name"
  | "first_name"
  | "last_name"
  | "email"
  | "first_seen"
  | "tags"
  | "event_approved_count"
  | "event_checked_in_count"
  | "membership_name"
  | "membership_status";

const ALIASES: Record<CanonicalField, readonly string[]> = {
  user_api_id: ["user_api_id", "api_id", "luma_id", "user_id", "id"],
  name: ["name", "full_name", "member_name"],
  first_name: ["first_name", "firstname", "given_name", "first"],
  last_name: ["last_name", "lastname", "surname", "family_name", "last"],
  email: ["email", "email_address", "e_mail", "mail"],
  first_seen: [
    "first_seen",
    "joined",
    "joined_at",
    "date_joined",
    "signup_date",
    "created_at",
    "registered_at",
  ],
  tags: ["tags", "labels"],
  event_approved_count: [
    "event_approved_count",
    "events_approved",
    "approved_events",
    "approved",
    "rsvps",
    "rsvp_count",
  ],
  event_checked_in_count: [
    "event_checked_in_count",
    "events_checked_in",
    "checked_in",
    "check_ins",
    "checkins",
    "attended",
    "attendance",
  ],
  membership_name: ["membership_name", "membership", "plan", "tier"],
  membership_status: ["membership_status", "status", "member_status"],
};

const REQUIRED: readonly CanonicalField[] = ["user_api_id", "name", "email"];

function normalize(raw: string): string {
  return raw
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function mapHeaders(rawHeaders: string[]): {
  mapping: Record<string, CanonicalField>;
  unmapped: string[];
  missingRequired: CanonicalField[];
} {
  const aliasToCanonical = new Map<string, CanonicalField>();
  for (const canonical of Object.keys(ALIASES) as CanonicalField[]) {
    for (const a of ALIASES[canonical]) aliasToCanonical.set(a, canonical);
  }

  type Candidate = { raw: string; normalized: string };
  const candidates = new Map<CanonicalField, Candidate[]>();
  const unmapped: string[] = [];

  for (const raw of rawHeaders) {
    const norm = normalize(raw);
    const canonical = aliasToCanonical.get(norm);
    if (!canonical) {
      unmapped.push(raw);
      continue;
    }
    const list = candidates.get(canonical) ?? [];
    list.push({ raw, normalized: norm });
    candidates.set(canonical, list);
  }

  const mapping: Record<string, CanonicalField> = {};
  for (const [canonical, list] of candidates.entries()) {
    const exact = list.find((c) => c.normalized === canonical);
    const picked = exact ?? list[0];
    mapping[picked.raw] = canonical;
    for (const c of list) {
      if (c.raw !== picked.raw) unmapped.push(c.raw);
    }
  }

  const mappedCanonical = new Set<CanonicalField>(Object.values(mapping));
  const missingRequired = REQUIRED.filter((r) => !mappedCanonical.has(r));

  return { mapping, unmapped, missingRequired };
}
