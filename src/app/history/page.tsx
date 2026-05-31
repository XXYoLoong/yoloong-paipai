import { Button } from "@/components/ui/button";
import { HeaderControls } from "@/components/system/header-controls";
import { HistoryClient } from "@/components/history/history-client";
import { listPlans } from "@/lib/db/queries";

export default function HistoryPage() {
  const plans = listPlans();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="panel-elevated flex items-center justify-between rounded-xl px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <span className="kicker">Artifact Library</span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">历史计划</h1>
          <p className="text-sm text-slate-500">搜索、筛选、归档、复制与删除。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button href="/" variant="secondary">
            返回首页
          </Button>
          <HeaderControls />
        </div>
      </header>

      <HistoryClient initialPlans={plans} />
    </main>
  );
}
