"use client";

import * as React from "react";
import type { PlanReview } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel, Textarea } from "@/components/ui/field";

export function PlanReviewPanel({ planId }: { planId: string }) {
  const [reviews, setReviews] = React.useState<PlanReview[]>([]);
  const [summary, setSummary] = React.useState("");
  const [delayReasons, setDelayReasons] = React.useState("");

  React.useEffect(() => {
    void fetch(`/api/plans/${planId}/review`)
      .then((res) => res.json())
      .then((data: { reviews: PlanReview[] }) => setReviews(data.reviews ?? []));
  }, [planId]);

  async function submit() {
    const response = await fetch(`/api/plans/${planId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        summary,
        delayReasons: delayReasons
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    const data = (await response.json()) as { review: PlanReview };
    if (data.review) {
      setReviews((current) => [data.review, ...current]);
      setSummary("");
      setDelayReasons("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>复盘</CardTitle>
        <CardDescription>记录完成率、延期原因，并反哺记忆中心。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field>
          <FieldLabel>复盘摘要</FieldLabel>
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="本次执行收获与改进点" />
        </Field>
        <Field>
          <FieldLabel>延期原因（逗号分隔）</FieldLabel>
          <Textarea value={delayReasons} onChange={(e) => setDelayReasons(e.target.value)} placeholder="如 时间不足, 信息不全" />
        </Field>
        <Button type="button" onClick={submit}>
          保存复盘
        </Button>
        {reviews.map((review) => (
          <div className="rounded-lg border border-slate-200 p-3 text-sm" key={review.id}>
            <div className="font-medium text-slate-950">完成率 {(review.completionRate * 100).toFixed(0)}%</div>
            <p className="mt-1 text-slate-600">{review.summary}</p>
            {review.delayReasons.length ? (
              <p className="mt-1 text-xs text-slate-500">延期：{review.delayReasons.join("、")}</p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
