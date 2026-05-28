import { Button } from "@/components/ui/button";
import { HistoryClient } from "@/components/history/history-client";
import { listPlans } from "@/lib/db/queries";

export default function HistoryPage() {
  const plans = listPlans();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">历史计划</h1>
          <p className="mt-1 text-sm text-slate-500">搜索、筛选、归档、复制与删除。</p>
        </div>
        <Button href="/" variant="secondary">
          返回首页
        </Button>
      </header>

      <HistoryClient initialPlans={plans} />
    </main>
  );
}
