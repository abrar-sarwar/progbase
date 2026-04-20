import { getAnalytics } from "@/lib/analytics";
import { Section } from "@/components/ui/section";
import { GrowthChart } from "@/components/charts/growth-chart";
import { AttendanceChart } from "@/components/charts/attendance-chart";
import { ActiveDormantChart } from "@/components/charts/active-dormant-chart";
import { EmailDomainChart } from "@/components/charts/email-domain-chart";
import { DemographicsChart } from "@/components/charts/demographics-chart";

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export default async function AnalyticsPage() {
  const a = await getAnalytics();

  if (a.total === 0) {
    return (
      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-sm text-zinc-500">
          No members yet. Upload the Luma CSV to see analytics.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-6">
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-zinc-900">
        Analytics
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        {a.total.toLocaleString()} visible members. Blocked members excluded
        from all counts.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Section
          title="Member growth"
          subtitle="Cumulative, by month of first Luma event"
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
      </div>
    </main>
  );
}
