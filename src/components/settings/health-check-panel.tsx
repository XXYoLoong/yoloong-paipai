"use client";

import * as React from "react";
import { Activity, CheckCircle2, CircleAlert, CircleHelp, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type HealthItem = {
  key: string;
  label: string;
  status: "ok" | "warn" | "error";
  message: string;
};

type HealthResponse = {
  generatedAt: string;
  checks: HealthItem[];
  summary: string;
  error?: string;
};

const statusConfig = {
  ok: {
    label: "正常",
    tone: "teal" as const,
    icon: CheckCircle2,
    className: "border-teal-200 bg-teal-50 text-teal-800",
  },
  warn: {
    label: "需关注",
    tone: "amber" as const,
    icon: CircleHelp,
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  error: {
    label: "异常",
    tone: "rose" as const,
    icon: CircleAlert,
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
};

export function HealthCheckPanel() {
  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const runCheck = React.useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/tools/health", { cache: "no-store" });
      const data = (await response.json()) as HealthResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "健康检查失败");
      }
      setHealth(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "健康检查失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>工具健康检查</CardTitle>
            <CardDescription>检测模型、搜索、数据库、导出和访问保护状态。</CardDescription>
          </div>
          <Button type="button" variant="secondary" onClick={runCheck} disabled={isLoading}>
            <RefreshCw data-icon="inline-start" className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
            重新检测
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {health ? (
          <>
            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4">
              <Activity className="mt-0.5 text-teal-700" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold text-slate-950">{health.summary}</div>
                <div className="mt-1 text-xs text-slate-500">
                  检测时间：{new Date(health.generatedAt).toLocaleString("zh-CN")}
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {health.checks.map((item) => {
                const config = statusConfig[item.status];
                const Icon = config.icon;
                return (
                  <div className={`rounded-lg border p-4 ${config.className}`} key={item.key}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <Icon className="mt-0.5" aria-hidden="true" />
                        <div>
                          <div className="font-medium">{item.label}</div>
                          <p className="mt-1 text-sm leading-6">{item.message}</p>
                        </div>
                      </div>
                      <Badge tone={config.tone}>{config.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            {isLoading ? "正在检测关键工具..." : "尚未执行健康检查。"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
