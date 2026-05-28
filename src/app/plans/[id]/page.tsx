import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskBoard } from "@/components/planner/task-board";
import { PlanTimeline } from "@/components/planner/plan-timeline";
import { ExportPanel } from "@/components/planner/export-panel";
import { PlanReviewPanel } from "@/components/planner/plan-review-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getLatestAgentRun, getPlan } from "@/lib/db/queries";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const credibilityTone: Record<string, "teal" | "indigo" | "amber" | "slate"> = {
  high: "teal",
  medium: "indigo",
  low: "amber",
  unverified: "slate",
};

export default async function PlanPage({ params }: PageProps) {
  const { id } = await params;
  const plan = getPlan(id);

  if (!plan) {
    notFound();
  }

  const agentRun = getLatestAgentRun(id);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <Link className="text-sm font-medium text-teal-700 hover:text-teal-900" href="/">
            返回首页
          </Link>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">{plan.title}</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-500">{plan.summary}</p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="teal">{plan.goalType}</Badge>
            <Badge tone="indigo">{plan.tasks.length} 个任务</Badge>
            {plan.promptVersion ? <Badge tone="slate">Prompt {plan.promptVersion}</Badge> : null}
            <Badge tone="slate">{new Date(plan.createdAt).toLocaleString("zh-CN")}</Badge>
          </div>
        </div>
        <a href={`/api/export/${plan.id}?format=md`}>
          <Button type="button" variant="secondary">
            快速导出 Markdown
          </Button>
        </a>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <PlanTimeline plan={plan} />
          <TaskBoard plan={plan} />
        </div>
        <aside className="flex flex-col gap-6">
          <div id="export">
            <ExportPanel planId={plan.id} planTitle={plan.title} />
          </div>

          <PlanReviewPanel planId={plan.id} />

          {agentRun ? (
            <Card>
              <CardHeader>
                <CardTitle>Agent 阶段日志</CardTitle>
                <CardDescription>
                  {agentRun.modelName} · {agentRun.status}
                  {agentRun.promptVersion ? ` · ${agentRun.promptVersion}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {agentRun.stageLog.map((stage) => (
                  <div className="rounded-md bg-slate-50 p-2 text-xs leading-5 text-slate-600" key={`${stage.stage}-${stage.message}`}>
                    {stage.message}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>原始目标</CardTitle>
              <CardDescription>Agent 用它作为拆解入口。</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-slate-700">{plan.originalGoal}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>假设与追问</CardTitle>
              <CardDescription>信息不足时，先按这些假设执行。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ListBlock title="假设" items={plan.assumptions} />
              <ListBlock title="补充问题" items={plan.followUpQuestions.length ? plan.followUpQuestions : ["暂无"]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>搜索来源</CardTitle>
              <CardDescription>含可信度分级（F-05）。</CardDescription>
            </CardHeader>
            <CardContent className="flex max-h-[420px] flex-col gap-3 overflow-auto">
              {plan.evidenceItems.length ? (
                plan.evidenceItems.map((item) => (
                  <a
                    className="rounded-md border border-slate-200 p-3 text-sm leading-6 transition hover:border-teal-300 hover:bg-teal-50"
                    href={item.url}
                    key={item.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-950">{item.title}</span>
                      <Badge tone={credibilityTone[item.credibility ?? "unverified"] ?? "slate"}>
                        {item.credibility ?? "unverified"}
                      </Badge>
                    </div>
                    <span className="mt-1 block line-clamp-2 text-slate-500">{item.snippet}</span>
                    {item.citationReason ? <span className="mt-1 block text-xs text-slate-400">{item.citationReason}</span> : null}
                  </a>
                ))
              ) : (
                <p className="text-sm text-slate-500">暂无来源。</p>
              )}
            </CardContent>
            <CardFooter>
              <p className="text-xs leading-5 text-slate-500">来源只用于辅助判断，执行前仍建议人工复核。</p>
            </CardFooter>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-950">{title}</div>
      <ul className="mt-2 flex flex-col gap-2 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li className="rounded-md bg-slate-50 p-2" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
