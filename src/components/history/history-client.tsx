"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GoalType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel, Input } from "@/components/ui/field";

type PlanListItem = {
  id: string;
  title: string;
  summary: string;
  goalType: GoalType;
  status: string;
  createdAt: string;
};

export function HistoryClient({ initialPlans }: { initialPlans: PlanListItem[] }) {
  const router = useRouter();
  const [plans, setPlans] = React.useState(initialPlans);
  const [q, setQ] = React.useState("");
  const [goalType, setGoalType] = React.useState("");
  const [includeArchived, setIncludeArchived] = React.useState(false);

  async function reload() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (goalType) params.set("goalType", goalType);
    if (includeArchived) params.set("includeArchived", "true");

    const response = await fetch(`/api/plans?${params.toString()}`);
    const data = (await response.json()) as { plans: PlanListItem[] };
    setPlans(data.plans ?? []);
  }

  async function handleAction(planId: string, action: "archive" | "unarchive" | "clone") {
    const response = await fetch(`/api/plans/${planId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = (await response.json()) as { plan?: PlanListItem };

    if (action === "clone" && data.plan) {
      router.push(`/plans/${data.plan.id}`);
      return;
    }

    await reload();
  }

  async function handleDelete(planId: string) {
    if (!window.confirm("确定删除该计划？此操作不可恢复。")) {
      return;
    }
    await fetch(`/api/plans/${planId}`, { method: "DELETE" });
    await reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>全部计划</CardTitle>
        <CardDescription>支持搜索、类型筛选与归档管理。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field>
            <FieldLabel>关键词</FieldLabel>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="标题或目标" />
          </Field>
          <Field>
            <FieldLabel>类型</FieldLabel>
            <select
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              value={goalType}
              onChange={(e) => setGoalType(e.target.value)}
            >
              <option value="">全部</option>
              {["travel", "study", "event", "career", "shopping", "health", "general"].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            显示已归档
          </label>
        </div>
        <Button type="button" variant="secondary" onClick={reload}>
          应用筛选
        </Button>

        <div className="flex flex-col gap-3">
          {plans.length ? (
            plans.map((plan) => (
              <div className="rounded-lg border border-slate-200 p-4" key={plan.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <Link className="flex-1 hover:text-teal-800" href={`/plans/${plan.id}`}>
                    <div className="font-medium text-slate-950">{plan.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{plan.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone="teal">{plan.goalType}</Badge>
                      <Badge>{plan.status}</Badge>
                      <Badge>{new Date(plan.createdAt).toLocaleDateString("zh-CN")}</Badge>
                    </div>
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => handleAction(plan.id, "clone")}>
                      复制
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAction(plan.id, plan.status === "archived" ? "unarchive" : "archive")}
                    >
                      {plan.status === "archived" ? "取消归档" : "归档"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => handleDelete(plan.id)}>
                      删除
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">没有匹配的计划。</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
