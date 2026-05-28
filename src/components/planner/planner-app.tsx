"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CalendarDays, CheckCircle2, CircleDashed, Loader2, Search, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import type { GoalTemplate, PlanWithTasks } from "@/lib/types";
import { toCommaList } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel, Input, Textarea } from "@/components/ui/field";
import { TaskBoard } from "@/components/planner/task-board";
import { TemplatePicker } from "@/components/planner/template-picker";
import { detectSensitiveInput } from "@/lib/agent/heuristics";
import type { StageLogEntry } from "@/lib/types";

type GenerateResponse = {
  planId: string;
  storedPlan: PlanWithTasks;
  stageLog: Array<{ stage: string; status: string; message: string }>;
  warnings: string[];
};

const plannerFormSchema = z.object({
  goal: z.string().trim().min(8, "目标至少需要 8 个字"),
  deadline: z.string().default(""),
  budget: z
    .union([z.literal(""), z.string().trim().regex(/^\d+(\.\d+)?$/, "预算需要是正数"), z.number().positive()])
    .default(""),
  location: z.string().default(""),
  preferencesText: z.string().default(""),
  constraintsText: z.string().default(""),
  enableSearch: z.boolean(),
  qualityMode: z.enum(["fast", "quality"]),
  templateId: z.string().optional(),
  memoryMode: z.enum(["on", "off"]).default("on"),
});

type FormInput = z.input<typeof plannerFormSchema>;
type FormValues = z.output<typeof plannerFormSchema>;

const examples = [
  "策划三天北京周末游，预算 3000 元，偏好文化景点和本地美食",
  "一个月准备大学英语四级考试，每天最多学习 2 小时",
  "组织一次 30 人班级团建，需要控制预算并准备应急预案",
];

export function PlannerApp({
  recentPlans,
  templates,
}: {
  recentPlans: Array<{ id: string; title: string; summary: string; createdAt: string }>;
  templates: GoalTemplate[];
}) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generated, setGenerated] = React.useState<GenerateResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [liveStages, setLiveStages] = React.useState<StageLogEntry[]>([]);
  const [liveWarnings, setLiveWarnings] = React.useState<string[]>([]);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(plannerFormSchema),
    defaultValues: {
      goal: "策划三天北京周末游，预算 3000 元，偏好文化景点和本地美食",
      deadline: "",
      budget: "",
      location: "",
      preferencesText: "",
      constraintsText: "",
      enableSearch: true,
      qualityMode: "fast",
      templateId: undefined,
      memoryMode: "on",
    },
  });
  const qualityMode = useWatch({
    control: form.control,
    name: "qualityMode",
  });

  function buildPayload(values: FormValues) {
    return {
      goal: values.goal,
      deadline: values.deadline || undefined,
      budget: values.budget ? Number(values.budget) : undefined,
      location: values.location || undefined,
      preferences: toCommaList(values.preferencesText),
      constraints: toCommaList(values.constraintsText),
      enableSearch: values.enableSearch,
      qualityMode: values.qualityMode,
      templateId: values.templateId,
      memoryMode: values.memoryMode,
    };
  }

  async function onSubmit(values: FormValues) {
    if (detectSensitiveInput(values.goal)) {
      const ok = window.confirm("检测到目标中可能包含敏感信息，建议先脱敏。仍要继续生成吗？");
      if (!ok) return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerated(null);
    setLiveStages([]);
    setLiveWarnings([]);

    const payload = buildPayload(values);

    try {
      const streamed = await generateViaSse(payload);
      if (streamed) {
        setGenerated(streamed);
        return;
      }
    } catch {
      // fallback below
    }

    try {
      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as GenerateResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "生成失败");
      }

      setGenerated(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "生成失败");
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateViaSse(payload: ReturnType<typeof buildPayload>) {
    const response = await fetch("/api/plans/generate/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      return null;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const json = JSON.parse(line.replace(/^data:\s*/, "")) as {
          type: string;
          stage?: string;
          status?: string;
          message?: string;
          planId?: string;
          storedPlan?: PlanWithTasks;
          stageLog?: StageLogEntry[];
          warnings?: string[];
        };

        if (json.type === "stage" && json.stage && json.status && json.message) {
          const entry = { stage: json.stage, status: json.status, message: json.message } as StageLogEntry;
          setLiveStages((current) => [...current, entry]);
        }
        if (json.type === "warning" && json.message) {
          setLiveWarnings((current) => [...current, json.message!]);
        }
        if (json.type === "done" && json.storedPlan) {
          return {
            planId: json.planId!,
            storedPlan: json.storedPlan,
            stageLog: json.stageLog ?? [],
            warnings: json.warnings ?? [],
          } satisfies GenerateResponse;
        }
        if (json.type === "error") {
          throw new Error(json.message ?? "流式生成失败");
        }
      }
    }

    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-teal-700 text-white">
            <Sparkles aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">游龙排排</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              输入复杂目标，Agent 拆解步骤、查询必要信息，并生成可编辑的待办清单。
            </p>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          <Link href="/history">
            <Button type="button" variant="secondary">历史计划</Button>
          </Link>
          <Link href="/settings">
            <Button type="button" variant="ghost">设置</Button>
          </Link>
        </nav>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(360px,440px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>目标输入</CardTitle>
            <CardDescription>先描述你真正想完成的事，其他条件可以留空，系统会自动补问题。</CardDescription>
          </CardHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent>
              <FieldGroup>
                <TemplatePicker
                  templates={templates}
                  onApply={(payload) => {
                    form.reset({
                      goal: payload.goal,
                      deadline: payload.deadline ?? "",
                      budget: payload.budget ?? "",
                      location: payload.location ?? "",
                      preferencesText: payload.preferencesText ?? "",
                      constraintsText: payload.constraintsText ?? "",
                      enableSearch: payload.enableSearch ?? true,
                      qualityMode: payload.qualityMode ?? "fast",
                      templateId: payload.templateId,
                      memoryMode: "on",
                    });
                  }}
                />

                <Field>
                  <FieldLabel htmlFor="goal">复杂目标</FieldLabel>
                  <Textarea id="goal" {...form.register("goal")} />
                  <FieldDescription>{form.formState.errors.goal?.message ?? "至少 8 个字，支持旅行、学习、活动、求职、采购等目标。"}</FieldDescription>
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="deadline">截止时间</FieldLabel>
                    <Input id="deadline" placeholder="如 2026-06-30" {...form.register("deadline")} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="budget">预算</FieldLabel>
                    <Input id="budget" type="number" placeholder="如 3000" {...form.register("budget")} />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="location">地点</FieldLabel>
                  <Input id="location" placeholder="如 北京 / 校内 / 线上" {...form.register("location")} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="preferences">偏好</FieldLabel>
                  <Input id="preferences" placeholder="用逗号分隔，如 省钱, 文化景点, 稳妥" {...form.register("preferencesText")} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="constraints">限制条件</FieldLabel>
                  <Input id="constraints" placeholder="用逗号分隔，如 不熬夜, 不公开个人信息" {...form.register("constraintsText")} />
                </Field>

                <div className="grid gap-3 rounded-lg bg-slate-50 p-3">
                  <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
                    <input className="size-4 accent-teal-700" type="checkbox" {...form.register("enableSearch")} />
                    启用本地 SearXNG 搜索
                  </label>
                  <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
                    <input
                      className="size-4 accent-teal-700"
                      type="checkbox"
                      checked={qualityMode === "quality"}
                      onChange={(event) => form.setValue("qualityMode", event.currentTarget.checked ? "quality" : "fast")}
                    />
                    使用高质量模型
                  </label>
                  <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
                    <input
                      className="size-4 accent-teal-700"
                      type="checkbox"
                      checked={form.getValues("memoryMode") === "on"}
                      onChange={(e) => form.setValue("memoryMode", e.target.checked ? "on" : "off")}
                    />
                    启用 Agent 记忆检索
                  </label>
                </div>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-between">
              <Button type="submit" disabled={isGenerating}>
                {isGenerating ? <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : <ArrowRight data-icon="inline-start" aria-hidden="true" />}
                生成计划
              </Button>
              <Button type="button" variant="ghost" onClick={() => form.reset()}>
                清空
              </Button>
            </CardFooter>
          </form>
        </Card>

        <section className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoStrip icon={ShieldCheck} title="私有保存" description="计划只进入本地数据库" />
            <InfoStrip icon={Search} title="本地搜索" description="通过自部署 SearXNG 查询" />
            <InfoStrip icon={CalendarDays} title="可执行" description="任务能编辑、排序、导出" />
          </div>

          {error ? (
            <Card className="border-rose-200 bg-rose-50">
              <CardContent>
                <p className="text-sm text-rose-700">{error}</p>
              </CardContent>
            </Card>
          ) : null}

          {isGenerating ? <GeneratingPanel stages={liveStages} warnings={liveWarnings} /> : null}

          {generated?.storedPlan ? (
            <GeneratedPanel response={generated} onPlanChange={(plan) => setGenerated({ ...generated, storedPlan: plan })} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>示例目标</CardTitle>
                <CardDescription>点一下即可填入表单，适合快速演示。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {examples.map((example) => (
                  <button
                    className="rounded-lg border border-slate-200 bg-white p-4 text-left text-sm leading-6 text-slate-700 transition hover:border-teal-300 hover:bg-teal-50"
                    key={example}
                    type="button"
                    onClick={() => form.setValue("goal", example)}
                  >
                    {example}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {recentPlans.length ? (
            <Card>
              <CardHeader>
                <CardTitle>最近计划</CardTitle>
                <CardDescription>继续查看已保存的任务拆解。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {recentPlans.slice(0, 3).map((plan) => (
                  <Link className="rounded-lg border border-slate-200 p-4 transition hover:border-teal-300 hover:bg-slate-50" href={`/plans/${plan.id}`} key={plan.id}>
                    <div className="font-medium text-slate-950">{plan.title}</div>
                    <div className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{plan.summary}</div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function InfoStrip({ icon: Icon, title, description }: { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex size-10 items-center justify-center rounded-md bg-slate-100 text-teal-700">
        <Icon aria-hidden={true} />
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-950">{title}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
    </div>
  );
}

function GeneratingPanel({ stages, warnings }: { stages: StageLogEntry[]; warnings: string[] }) {
  const fallback = ["理解目标", "规划搜索", "查询资料", "生成任务", "校验保存"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent 正在排排（SSE 实时）</CardTitle>
        <CardDescription>这通常会在一分钟内完成；失败时自动回退同步接口。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {warnings.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{warnings.join("；")}</div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {(stages.length ? stages : fallback.map((label) => ({ stage: label, status: "done" as const, message: label }))).map((stage) => (
            <div className="flex items-center gap-2 rounded-md bg-slate-50 p-3 text-sm text-slate-600" key={`${stage.stage}-${stage.message}`}>
              {stages.length ? <CheckCircle2 className="text-teal-700" aria-hidden="true" /> : <CircleDashed className="animate-spin" aria-hidden="true" />}
              {stage.message}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GeneratedPanel({ response, onPlanChange }: { response: GenerateResponse; onPlanChange: (plan: PlanWithTasks) => void }) {
  const plan = response.storedPlan;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{plan.title}</CardTitle>
              <CardDescription>{plan.summary}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="teal">{plan.goalType}</Badge>
              <Badge tone="indigo">{plan.tasks.length} 个任务</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {response.warnings.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
              {response.warnings.join("；")}
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {response.stageLog.map((stage) => (
              <div className="flex items-start gap-2 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-600" key={`${stage.stage}-${stage.message}`}>
                <CheckCircle2 className="mt-0.5 text-teal-700" aria-hidden="true" />
                <span>{stage.message}</span>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <Link href={`/plans/${plan.id}`}>
            <Button type="button" variant="secondary">打开独立计划页</Button>
          </Link>
          <Link href={`/plans/${plan.id}#export`}>
            <Button type="button" variant="ghost">导出中心</Button>
          </Link>
        </CardFooter>
      </Card>

      <TaskBoard plan={plan} onPlanChange={onPlanChange} />
    </div>
  );
}
