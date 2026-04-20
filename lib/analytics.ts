import "server-only";
import { supabaseServer } from "./supabase-server";
import type { Member } from "./types";

export type AnalyticsData = {
  total: number;
  growth: { month: string; cumulative: number }[];
  attendance: { bucket: string; count: number }[];
  activeDormant: { active: number; dormant: number };
  emailDomains: { domain: string; count: number }[];
  demographics: {
    major: { label: string; count: number }[];
    gradYear: { label: string; count: number }[];
    gender: { label: string; count: number }[];
    coverage: { major: number; gradYear: number; gender: number };
  };
};

function bucketForApproved(n: number): string {
  if (n <= 0) return "0";
  if (n === 1) return "1";
  if (n <= 3) return "2-3";
  if (n <= 5) return "4-5";
  if (n <= 10) return "6-10";
  return "10+";
}

const BUCKET_ORDER = ["0", "1", "2-3", "4-5", "6-10", "10+"];

function domainOf(email: string | null): string | null {
  if (!email) return null;
  const idx = email.lastIndexOf("@");
  if (idx === -1) return null;
  const d = email.slice(idx + 1).trim().toLowerCase();
  return d || null;
}

function monthKey(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function topN<T extends { count: number }>(arr: T[], n: number): T[] {
  return [...arr].sort((a, b) => b.count - a.count).slice(0, n);
}

function fieldFilled(v: string | null | undefined): boolean {
  return !!(v && v.trim().length > 0);
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const { data, error } = await supabaseServer
    .from("members")
    .select("*")
    .eq("hidden", false);
  if (error) throw new Error(error.message);
  const members = (data as Member[]) ?? [];
  const total = members.length;

  const monthCounts = new Map<string, number>();
  for (const m of members) {
    const k = monthKey(m.first_seen);
    if (!k) continue;
    monthCounts.set(k, (monthCounts.get(k) ?? 0) + 1);
  }
  const months = Array.from(monthCounts.keys()).sort();
  let running = 0;
  const growth = months.map((month) => {
    running += monthCounts.get(month) ?? 0;
    return { month, cumulative: running };
  });

  const bucketCounts = new Map<string, number>();
  for (const b of BUCKET_ORDER) bucketCounts.set(b, 0);
  for (const m of members) {
    const key = bucketForApproved(m.event_approved_count);
    bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
  }
  const attendance = BUCKET_ORDER.map((bucket) => ({
    bucket,
    count: bucketCounts.get(bucket) ?? 0,
  }));

  let active = 0;
  for (const m of members) if (m.event_checked_in_count >= 1) active++;
  const activeDormant = { active, dormant: total - active };

  const domainCounts = new Map<string, number>();
  for (const m of members) {
    const d = domainOf(m.email);
    if (!d) continue;
    domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
  }
  const emailDomains = topN(
    Array.from(domainCounts, ([domain, count]) => ({ domain, count })),
    10,
  );

  function tally(field: "major" | "grad_year" | "gender") {
    const map = new Map<string, number>();
    for (const m of members) {
      const v = m[field];
      if (!fieldFilled(v)) continue;
      const key = v!.trim();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return topN(
      Array.from(map, ([label, count]) => ({ label, count })),
      20,
    );
  }
  const major = tally("major");
  const gradYear = tally("grad_year");
  const gender = tally("gender");
  const coverage = {
    major:
      total === 0
        ? 0
        : members.filter((m) => fieldFilled(m.major)).length / total,
    gradYear:
      total === 0
        ? 0
        : members.filter((m) => fieldFilled(m.grad_year)).length / total,
    gender:
      total === 0
        ? 0
        : members.filter((m) => fieldFilled(m.gender)).length / total,
  };

  return {
    total,
    growth,
    attendance,
    activeDormant,
    emailDomains,
    demographics: { major, gradYear, gender, coverage },
  };
}
