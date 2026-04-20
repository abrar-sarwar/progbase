export function isAllowed(
  email: string | null | undefined,
  rawAllowlist: string | undefined,
): boolean {
  if (!email) return false;
  if (!rawAllowlist) return false;
  const target = email.trim().toLowerCase();
  if (!target) return false;
  const entries = rawAllowlist
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  return entries.includes(target);
}
