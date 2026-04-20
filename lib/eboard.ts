/**
 * E-BOARD ROSTER — for auto-flagging members who are on the progsu e-board.
 *
 * Match strategy per entry:
 *   - `email`: exact (case-insensitive, trimmed) match against member.email.
 *     Use this for common first names ("jamal", "jared") where name-only
 *     matching would false-flag non-e-board members with the same word.
 *   - `name`:  all space-delimited parts must appear as words in member.name
 *     (case-insensitive). Fine for unambiguous names like "joey zhang" or
 *     unique single names like "taizo".
 *
 * An entry may have name, email, or both. If both are present, a match on
 * either one flags the member.
 *
 * Update this list as the e-board changes and commit.
 */

export type EboardEntry = {
  /** Display label used in the "not yet in roster" list. */
  label: string;
  /** Optional email for exact-email matching. */
  email?: string;
  /** Optional name for word-match against member.name. */
  name?: string;
};

export const EBOARD: readonly EboardEntry[] = [
  { label: "Joey Zhang", name: "joey zhang" },
  { label: "Charan", name: "charan" },
  { label: "Jared Beresford", email: "jaredberesford@gmail.com" },
  { label: "Liam Word", email: "liam.word@gmail.com" },
  { label: "John Sang", name: "john sang" },
  { label: "Taizo", name: "taizo" },
  { label: "Fred", name: "fred" },
  { label: "Jamal (Joshua Ford)", email: "jamaljoshuaford23@gmail.com" },
  { label: "Dev", name: "dev" },
  { label: "Phillip Sanches", email: "phillip-sanches@outlook.com" },
  { label: "Arhaan", name: "arhaan" },
  { label: "Arturo", name: "arturo" },
  { label: "Carter", name: "carter" },
  { label: "Eda", name: "eda" },
  { label: "Ishan", name: "ishan" },
  { label: "Greg", name: "greg" },
  { label: "Poorav", name: "poorav" },
  { label: "nkano", name: "nkano" },
  { label: "Nina", name: "nina" },
  { label: "Natasha", name: "natasha" },
  { label: "Trang", name: "trang" },
  { label: "Ibe", name: "ibe" },
  { label: "Abrar Sarwar", name: "abrar sarwar" },
];

export type MemberLike = {
  name?: string | null;
  email?: string | null;
};

function wordsOf(s: string): Set<string> {
  return new Set(s.trim().toLowerCase().split(/\s+/).filter(Boolean));
}

function partsOf(entry: string): string[] {
  return entry.toLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesEntry(
  member: MemberLike,
  entry: EboardEntry,
): boolean {
  if (entry.email) {
    const a = (member.email ?? "").trim().toLowerCase();
    const b = entry.email.trim().toLowerCase();
    if (a && a === b) return true;
  }
  if (entry.name) {
    const name = member.name ?? "";
    const words = wordsOf(name);
    const parts = partsOf(entry.name);
    if (parts.length > 0 && words.size > 0) {
      if (parts.every((p) => words.has(p))) return true;
    }
  }
  return false;
}

export function isEboard(member: MemberLike): boolean {
  if (!member.name && !member.email) return false;
  return EBOARD.some((e) => matchesEntry(member, e));
}

export function missingFromRoster(
  members: MemberLike[],
): EboardEntry[] {
  return EBOARD.filter(
    (entry) => !members.some((m) => matchesEntry(m, entry)),
  );
}
