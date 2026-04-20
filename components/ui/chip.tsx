import { cn } from "@/lib/cn";

type Tone = "zinc" | "amber" | "green" | "red" | "violet";

const tones: Record<Tone, string> = {
  zinc:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  amber:
    "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  green:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300",
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
