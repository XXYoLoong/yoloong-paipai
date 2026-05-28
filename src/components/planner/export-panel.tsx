"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const formats = [
  { key: "md", label: "Markdown" },
  { key: "docx", label: "Word" },
  { key: "pdf", label: "PDF" },
  { key: "xlsx", label: "Excel 任务表" },
  { key: "bundle", label: "提交素材包 ZIP" },
] as const;

export function ExportPanel({ planId, planTitle }: { planId: string; planTitle: string }) {
  const [reportMd, setReportMd] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function generateReport() {
    setLoading(true);
    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = (await response.json()) as { markdown: string };
      setReportMd(data.markdown);
    } finally {
      setLoading(false);
    }
  }

  function download(format: string) {
    window.open(`/api/export/${planId}?format=${format}`, "_blank");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>导出中心</CardTitle>
        <CardDescription>{planTitle} — 导出前会自动扫描敏感信息。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {formats.map((format) => (
            <Button key={format.key} type="button" variant="secondary" size="sm" onClick={() => download(format.key)}>
              {format.label}
            </Button>
          ))}
        </div>
        <Button type="button" variant="ghost" disabled={loading} onClick={generateReport}>
          {loading ? "生成中…" : "生成报告草稿"}
        </Button>
        {reportMd ? (
          <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">{reportMd.slice(0, 2000)}…</pre>
        ) : null}
      </CardContent>
    </Card>
  );
}
