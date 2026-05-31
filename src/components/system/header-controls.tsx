"use client";

import * as React from "react";
import { Command } from "lucide-react";
import { ThemeToggle } from "@/components/system/theme-toggle";
import { openCommandMenu } from "@/components/system/command-menu";

export function HeaderControls() {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => openCommandMenu()}
        aria-label="打开命令面板"
        title="命令面板（⌘K / Ctrl+K）"
        className="inline-flex h-10 items-center gap-2 rounded-md border border-hairline bg-surface-2 px-3 text-sm text-slate-600 transition hover:border-hairline-strong hover:text-slate-950"
      >
        <Command className="size-4" aria-hidden="true" />
        <span className="meta-mono hidden text-xs sm:inline">K</span>
      </button>
      <ThemeToggle />
    </div>
  );
}
