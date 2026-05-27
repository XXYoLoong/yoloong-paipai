import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskBoard } from "@/components/planner/task-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlan } from "@/lib/db/queries";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PlanPage({ params }: PageProps) {
  const { id } = await params;
  const plan = getPlan(id);

  if (!plan) {
    notFound();
  }

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
            <Badge tone="slate">{new Date(plan.createdAt).toLocaleString("zh-CN")}</Badge>
          </div>
        </div>
        <a href={`/api/export/${plan.id}.md`}>
          <Button type="button" variant="secondary">导出 Markdown</Button>
        </a>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <TaskBoard plan={plan} />
        <aside className="flex flex-col gap-6">
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
              <CardDescription>启用搜索后保存的公开资料。</CardDescription>
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
                    <span className="font-medium text-slate-950">{item.title}</span>
                    <span className="mt-1 block line-clamp-2 text-slate-500">{item.snippet}</span>
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

