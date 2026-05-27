import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listPlans } from "@/lib/db/queries";

export default function HistoryPage() {
  const plans = listPlans();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">历史计划</h1>
          <p className="mt-1 text-sm text-slate-500">查看已经生成并保存到本地数据库的计划。</p>
        </div>
        <Link href="/">
          <Button type="button" variant="secondary">返回首页</Button>
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>全部计划</CardTitle>
          <CardDescription>按创建时间倒序排列。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {plans.length ? (
            plans.map((plan) => (
              <Link className="rounded-lg border border-slate-200 p-4 transition hover:border-teal-300 hover:bg-slate-50" href={`/plans/${plan.id}`} key={plan.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-medium text-slate-950">{plan.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{plan.summary}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Badge tone="teal">{plan.goalType}</Badge>
                    <Badge>{new Date(plan.createdAt).toLocaleDateString("zh-CN")}</Badge>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">还没有历史计划，先回首页生成一个。</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

