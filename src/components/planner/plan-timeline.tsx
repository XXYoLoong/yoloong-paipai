"use client";

import type { PlanWithTasks, StoredTask } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PlanTimeline({ plan }: { plan: PlanWithTasks }) {
  const taskIds = new Set(plan.tasks.map((task) => task.id));
  const tasks = [...plan.tasks].filter((task) => !task.parentTaskId).sort((a, b) => {
    const aDate = a.dueDate ?? "9999";
    const bDate = b.dueDate ?? "9999";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return a.sortOrder - b.sortOrder;
  });

  const doneIds = new Set(plan.tasks.filter((t) => t.status === "done").map((t) => t.id));

  function pendingDependencies(task: StoredTask) {
    return (task.dependencyIds ?? []).filter((dep) => taskIds.has(dep) && !doneIds.has(dep));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>时间轴与依赖</CardTitle>
        <CardDescription>按截止时间排序；仅当真实前置任务未完成时标记「待前置」。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tasks.slice(0, 12).map((task) => {
          const waitingOn = pendingDependencies(task);
          return (
          <div
            className={cn(
              "flex flex-col gap-1 rounded-lg border p-3 text-sm",
              waitingOn.length ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-slate-50",
            )}
            key={task.id}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-950">{task.title}</span>
              <Badge tone={task.status === "done" ? "teal" : "slate"}>{task.status}</Badge>
              {waitingOn.length ? <Badge tone="indigo">待前置</Badge> : null}
            </div>
            <div className="text-xs text-slate-500">
              {task.dueDate ? `截止 ${task.dueDate}` : "未设截止"}
              {task.estimatedMinutes ? ` · 约 ${task.estimatedMinutes} 分钟` : ""}
              {waitingOn.length ? ` · 等待 ${waitingOn.length} 个前置任务` : ""}
            </div>
          </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
