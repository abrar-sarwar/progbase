export const STALE_THRESHOLD_DAYS = 7;

export function staleDays(
  uploadedAt: string | null,
  now: number = Date.now(),
): number | null {
  if (!uploadedAt) return null;
  const t = new Date(uploadedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}

export function isStale(
  uploadedAt: string | null,
  now: number = Date.now(),
): boolean {
  const d = staleDays(uploadedAt, now);
  if (d === null) return false;
  return d > STALE_THRESHOLD_DAYS;
}
