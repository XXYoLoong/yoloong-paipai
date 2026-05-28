"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";

export function SettingsForm({
  initial,
}: {
  initial: { defaultEnableSearch: string; defaultQualityMode: string };
}) {
  const [enableSearch, setEnableSearch] = React.useState(initial.defaultEnableSearch === "true");
  const [qualityMode, setQualityMode] = React.useState<"fast" | "quality">(
    initial.defaultQualityMode === "quality" ? "quality" : "fast",
  );
  const [message, setMessage] = React.useState<string | null>(null);

  async function save() {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        defaultEnableSearch: enableSearch,
        defaultQualityMode: qualityMode,
      }),
    });
    if (response.ok) {
      setMessage("偏好已保存到本地 settings 表。");
    } else {
      setMessage("保存失败，请稍后重试。");
    }
  }

  async function clearData() {
    if (!window.confirm("将清空所有计划、任务与搜索缓存，设置项保留。确定继续？")) {
      return;
    }
    const response = await fetch("/api/settings/clear-data", { method: "POST" });
    setMessage(response.ok ? "数据已清空。" : "清空失败。");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>应用偏好（可写）</CardTitle>
        <CardDescription>保存在本地 SQLite，不存储 API Key。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
            <input type="checkbox" checked={enableSearch} onChange={(e) => setEnableSearch(e.target.checked)} />
            默认启用联网搜索
          </label>
          <Field>
            <FieldLabel>默认生成模式</FieldLabel>
            <select
              className="h-10 rounded-md border border-slate-200 px-3 text-sm"
              value={qualityMode}
              onChange={(e) => setQualityMode(e.target.value as "fast" | "quality")}
            >
              <option value="fast">快速</option>
              <option value="quality">高质量</option>
            </select>
            <FieldDescription>仅影响首页默认值，可在生成时覆盖。</FieldDescription>
          </Field>
        </FieldGroup>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存偏好
          </Button>
          <Button type="button" variant="secondary" onClick={clearData}>
            清空计划数据
          </Button>
        </div>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
