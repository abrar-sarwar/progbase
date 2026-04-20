/**
 * EBOARD NAME LIST — for auto-flagging members who are on the progsu e-board.
 * Used only for display ("E-BOARD" chip next to the member name); no analytics
 * filtering. Update as the e-board changes and commit.
 *
 * Entries can be one word (matches any word in a member's name) or two+ words
 * (all words must appear in the member's name, in any order). Case-insensitive.
 */
export const EBOARD_NAMES: readonly string[] = [
  "joey zhang",
  "charan",
  "jared",
  "liam",
  "john sang",
  "taizo",
  "fred",
  "jamal",
  "dev",
  "phillip",
  "arhaan",
  "arturo",
  "carter",
  "eda",
  "ishan",
  "greg",
  "poorav",
  "nkano",
  "nina",
  "natasha",
  "trang",
  "ibe",
  "abrar sarwar",
];

function wordsOf(s: string): Set<string> {
  return new Set(s.trim().toLowerCase().split(/\s+/).filter(Boolean));
}

function partsOf(entry: string): string[] {
  return entry.toLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesEntry(
  name: string | null | undefined,
  entry: string,
): boolean {
  if (!name) return false;
  const words = wordsOf(name);
  if (words.size === 0) return false;
  const parts = partsOf(entry);
  if (parts.length === 0) return false;
  return parts.every((p) => words.has(p));
}

export function isEboard(name: string | null | undefined): boolean {
  if (!name) return false;
  return EBOARD_NAMES.some((entry) => matchesEntry(name, entry));
}

export function missingFromRoster(
  memberNames: (string | null)[],
): string[] {
  return EBOARD_NAMES.filter(
    (entry) => !memberNames.some((n) => matchesEntry(n, entry)),
  ).map((e) => e);
}
