"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

function getCurrentTheme(): Theme {
  if (typeof document === "undefined") {
    return "dark";
  }
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

function subscribe(callback: () => void) {
  window.addEventListener("themechange", callback);
  return () => window.removeEventListener("themechange", callback);
}

export function useTheme() {
  const theme = React.useSyncExternalStore<Theme>(subscribe, getCurrentTheme, () => "dark");
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const toggle = React.useCallback(() => {
    applyTheme(getCurrentTheme() === "dark" ? "light" : "dark");
  }, []);

  return { theme, mounted, toggle, setTheme: applyTheme };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, mounted, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="切换白天 / 夜间主题"
      title={theme === "dark" ? "切换到白天" : "切换到夜间"}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-md border border-hairline bg-surface-2 text-slate-600 transition hover:border-hairline-strong hover:text-slate-950",
        className,
      )}
    >
      {!mounted ? (
        <span className="size-[18px]" aria-hidden="true" />
      ) : theme === "dark" ? (
        <Sun className="size-[18px]" aria-hidden="true" />
      ) : (
        <Moon className="size-[18px]" aria-hidden="true" />
      )}
    </button>
  );
}
