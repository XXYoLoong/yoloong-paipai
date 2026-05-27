import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "teal" | "slate" | "amber" | "rose" | "indigo";
};

const tones = {
  teal: "bg-teal-50 text-teal-800 ring-teal-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
};

export function Badge({ className, tone = "slate", ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset", tones[tone], className)}
      {...props}
    />
  );
}

