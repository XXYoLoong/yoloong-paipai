"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CommandIcon,
  CornerDownLeft,
  Home,
  Moon,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { applyTheme } from "@/components/system/theme-toggle";

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  keywords?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
};

export function openCommandMenu() {
  window.dispatchEvent(new CustomEvent("open-command-menu"));
}

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const openRef = React.useRef(false);

  const close = React.useCallback(() => setOpen(false), []);
  const openMenu = React.useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }, []);

  const commands = React.useMemo<CommandItem[]>(() => {
    const go = (path: string) => () => {
      close();
      router.push(path);
    };
    return [
      { id: "home", label: "回到首页", hint: "目标输入", group: "导航", keywords: "home shouye xinjian", icon: Home, run: go("/") },
      { id: "history", label: "历史计划", hint: "Artifact Library", group: "导航", keywords: "history lishi", icon: CalendarClock, run: go("/history") },
      { id: "settings", label: "设置", hint: "Control Surface", group: "导航", keywords: "settings shezhi config", icon: Settings, run: go("/settings") },
      {
        id: "theme-dark",
        label: "切换到夜间主题",
        hint: "Graphite",
        group: "外观",
        keywords: "dark yejian theme zhuti heise",
        icon: Moon,
        run: () => {
          applyTheme("dark");
          close();
        },
      },
      {
        id: "theme-light",
        label: "切换到白天主题",
        hint: "Daylight",
        group: "外观",
        keywords: "light baitian theme zhuti baise",
        icon: Sun,
        run: () => {
          applyTheme("light");
          close();
        },
      },
    ];
  }, [router, close]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return commands;
    }
    return commands.filter((item) =>
      `${item.label} ${item.hint ?? ""} ${item.keywords ?? ""} ${item.group}`.toLowerCase().includes(q),
    );
  }, [commands, query]);

  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (openRef.current) {
          close();
        } else {
          openMenu();
        }
      }
    };
    const onOpen = () => openMenu();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-menu", onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-menu", onOpen);
    };
  }, [close, openMenu]);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) {
    return null;
  }

  function onListKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      filtered[activeIndex]?.run();
    }
  }

  let lastGroup = "";

  return (
    <div
      className="cmdk-overlay fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div
        className="cmdk-panel panel-elevated w-full max-w-xl overflow-hidden rounded-xl"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        onKeyDown={onListKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-hairline px-4">
          <Search className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="搜索命令、页面、主题…"
            className="h-12 w-full bg-transparent text-sm text-slate-950 placeholder:text-slate-500 outline-none"
          />
          <kbd className="meta-mono hidden shrink-0 rounded border border-hairline bg-surface-2 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-auto p-2">
          {filtered.length ? (
            filtered.map((item, index) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.icon;
              const active = index === activeIndex;
              return (
                <React.Fragment key={item.id}>
                  {showGroup ? <div className="px-2 pb-1 pt-3 first:pt-1 kicker">{item.group}</div> : null}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => item.run()}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm transition",
                      active ? "bg-surface-3 text-slate-950" : "text-slate-700",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md border border-hairline",
                        active ? "border-teal-400/40 bg-teal-500/10 text-teal-300" : "bg-surface-2 text-slate-500",
                      )}
                    >
                      <Icon className="size-[16px]" />
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.hint ? <span className="meta-mono text-xs text-slate-500">{item.hint}</span> : null}
                    {active ? <CornerDownLeft className="size-3.5 text-slate-500" aria-hidden="true" /> : null}
                  </button>
                </React.Fragment>
              );
            })
          ) : (
            <div className="px-3 py-10 text-center text-sm text-slate-500">没有匹配的命令。</div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-hairline px-4 py-2.5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <CommandIcon className="size-3.5" aria-hidden="true" /> 命令面板
          </span>
          <span className="meta-mono flex items-center gap-2">
            <span>↑↓ 选择</span>
            <span>↵ 执行</span>
          </span>
        </div>
      </div>
    </div>
  );
}
