"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type SearchStatus = {
  status: "ok" | "warn" | "error" | "loading";
  message: string;
};

export function SearchStatusBanner() {
  const [searchStatus, setSearchStatus] = React.useState<SearchStatus>({
    status: "loading",
    message: "正在检测本地 SearXNG…",
  });

  const refresh = React.useCallback(async () => {
    setSearchStatus({ status: "loading", message: "正在检测本地 SearXNG…" });
    try {
      const response = await fetch("/api/tools/health", { cache: "no-store" });
      const data = (await response.json()) as {
        checks?: Array<{ key: string; status: "ok" | "warn" | "error"; message: string }>;
      };
      const searxng = data.checks?.find((item) => item.key === "searxng");
      if (!searxng) {
        setSearchStatus({ status: "warn", message: "未能读取 SearXNG 状态，请打开设置页重新检测。" });
        return;
      }
      setSearchStatus({ status: searxng.status, message: searxng.message });
    } catch {
      setSearchStatus({
        status: "error",
        message: "无法连接后端健康检查接口，请确认已运行 start-youlong-paipai.bat。",
      });
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  if (searchStatus.status === "loading") {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <RefreshCw className="mr-2 inline size-4 animate-spin" aria-hidden="true" />
        {searchStatus.message}
      </div>
    );
  }

  if (searchStatus.status === "ok") {
    return (
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        <CheckCircle2 className="mr-2 inline size-4" aria-hidden="true" />
        联网搜索已就绪：{searchStatus.message}
      </div>
    );
  }

  const isError = searchStatus.status === "error";

  return (
    <div
      className={`rounded-lg border p-4 text-sm leading-6 ${
        isError ? "border-rose-300 bg-rose-50 text-rose-900" : "border-amber-300 bg-amber-50 text-amber-950"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-start gap-2 font-semibold">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {isError ? "联网搜索不可用（将只能本地拆解，无法查询公开资料）" : "联网搜索未就绪（建议先修复再勾选搜索）"}
          </div>
          <p className="mt-2">{searchStatus.message}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>请先打开 Docker Desktop，等待左下角显示 Engine running。</li>
            <li>重新双击项目根目录的 <code className="rounded bg-white/70 px-1">start-youlong-paipai.bat</code> 一键启动。</li>
            <li>启动窗口若出现黄色/红色 SearXNG 提示，按提示处理后再生成计划。</li>
            <li>也可在设置页运行「工具健康检查」，确认 SearXNG 为绿色「正常」。</li>
          </ul>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => void refresh()}>
            重新检测
          </Button>
          <Button href="/settings" size="sm" variant="ghost">
            打开设置
          </Button>
        </div>
      </div>
    </div>
  );
}
