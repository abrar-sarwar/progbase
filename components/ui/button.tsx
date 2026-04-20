import { cn } from "@/lib/cn";
import * as React from "react";

type Variant = "primary" | "ghost" | "danger" | "outline";

const base =
  "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1";

const variants: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  danger: "text-zinc-500 hover:bg-red-50 hover:text-red-600",
  outline:
    "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ variant = "primary", className, ...rest }, ref) => (
  <button ref={ref} className={cn(base, variants[variant], className)} {...rest} />
));
Button.displayName = "Button";
