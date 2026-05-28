"use client";

import type { PlanWithTasks, StoredTask } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PlanTimeline({ plan }: { plan: PlanWithTasks }) {
  const tasks = [...plan.tasks].sort((a, b) => {
    const aDate = a.dueDate ?? "9999";
    const bDate = b.dueDate ?? "9999";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return a.sortOrder - b.sortOrder;
  });

  const doneIds = new Set(plan.tasks.filter((t) => t.status === "done").map((t) => t.id));

  function isBlocked(task: StoredTask) {
    return (task.dependencyIds ?? []).some((dep) => !doneIds.has(dep));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>时间轴与依赖</CardTitle>
        <CardDescription>按截止时间排序；前置未完成时标记阻塞。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tasks.slice(0, 12).map((task) => (
          <div
            className={cn(
              "flex flex-col gap-1 rounded-lg border p-3 text-sm",
              isBlocked(task) ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50",
            )}
            key={task.id}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-950">{task.title}</span>
              <Badge tone={task.status === "done" ? "teal" : "slate"}>{task.status}</Badge>
              {isBlocked(task) ? <Badge tone="amber">阻塞</Badge> : null}
            </div>
            <div className="text-xs text-slate-500">
              {task.dueDate ? `截止 ${task.dueDate}` : "未设截止"}
              {task.estimatedMinutes ? ` · 约 ${task.estimatedMinutes} 分钟` : ""}
              {(task.dependencyIds ?? []).length ? ` · 依赖 ${task.dependencyIds!.length} 项` : ""}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
