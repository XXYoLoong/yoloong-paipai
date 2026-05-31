import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-[var(--accent-ink)] font-semibold shadow-[0_0_0_1px_rgba(45,212,191,0.4),0_8px_24px_-12px_rgba(45,212,191,0.7)] hover:brightness-110 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none",
  secondary:
    "border border-hairline bg-surface-2 text-slate-800 hover:border-hairline-strong hover:text-slate-950 disabled:text-slate-400",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950 disabled:text-slate-400",
  danger: "bg-rose-500 text-white hover:bg-rose-400 disabled:bg-slate-300 disabled:text-slate-500",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  icon: "size-10 p-0",
};

function buttonClassName(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({ className, variant = "primary", size = "md", href, children, ...props }: ButtonProps) {
  const classes = buttonClassName(variant, size, className);

  if (href) {
    if (href.startsWith("http") || href.startsWith("/api/")) {
      return (
        <a href={href} className={classes}>
          {children}
        </a>
      );
    }

    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
