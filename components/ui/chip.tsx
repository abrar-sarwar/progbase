import { cn } from "@/lib/cn";

type Tone = "zinc" | "amber" | "green" | "red" | "indigo";

const tones: Record<Tone, string> = {
  zinc: "bg-zinc-100 text-zinc-700",
  amber: "bg-amber-50 text-amber-800",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  indigo: "bg-indigo-50 text-indigo-700",
};

export function Chip({
  tone = "zinc",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-sm px-1.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
