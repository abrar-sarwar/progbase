import { getAnalytics } from "@/lib/analytics";
import { Section } from "@/components/ui/section";
import { GrowthChart } from "@/components/charts/growth-chart";
import { AttendanceChart } from "@/components/charts/attendance-chart";
import { ActiveDormantChart } from "@/components/charts/active-dormant-chart";
import { EmailDomainChart } from "@/components/charts/email-domain-chart";
import { DemographicsChart } from "@/components/charts/demographics-chart";
import { AttendanceOverTimeChart } from "@/components/charts/attendance-over-time";

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export default async function AnalyticsPage() {
  const a = await getAnalytics();

  if (a.total === 0) {
    return (
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          No members yet. Upload the Luma CSV to see analytics.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="mb-8">
        <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
          Dashboard
        </span>
        <div className="mt-1 flex items-baseline gap-3">
          <h1 className="font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900 dark:text-zinc-50">
            Analytics
          </h1>
          <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {a.total.toLocaleString()} visible members
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Blocked members excluded from all counts. Members include both
          calendar-subscribed and auto-created event-only records.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Section
          title="Member growth"
          subtitle="Cumulative, by month first seen in any Luma export"
        >
          <GrowthChart data={a.growth} />
        </Section>
        <Section
          title="Attendance distribution"
          subtitle="Events approved per member"
        >
          <AttendanceChart data={a.attendance} />
        </Section>
        <Section
          title="Active vs dormant"
          subtitle="Members with ≥1 check-in vs 0"
        >
          <ActiveDormantChart data={a.activeDormant} />
        </Section>
        <Section title="Top email domains" subtitle="Top 10 by count">
          <EmailDomainChart data={a.emailDomains} />
        </Section>
        <Section
          title="Majors"
          subtitle={`${pct(a.demographics.coverage.major)} of members have this field filled`}
        >
          <DemographicsChart data={a.demographics.major} />
        </Section>
        <Section
          title="Grad years"
          subtitle={`${pct(a.demographics.coverage.gradYear)} of members have this field filled`}
        >
          <DemographicsChart data={a.demographics.gradYear} />
        </Section>
        <Section
          title="Gender"
          subtitle={`${pct(a.demographics.coverage.gender)} of members have this field filled`}
          className="md:col-span-2"
        >
          <DemographicsChart data={a.demographics.gender} />
        </Section>
        <Section
          title="Attendance over time"
          subtitle="Checked-in guests per event, oldest → newest"
          className="md:col-span-2"
        >
          <AttendanceOverTimeChart data={a.attendanceOverTime} />
        </Section>
      </div>
    </main>
  );
}
