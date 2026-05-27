import { NextResponse } from "next/server";
import { getPlan } from "@/lib/db/queries";
import { planToMarkdown } from "@/lib/export";

type RouteContext = {
  params: Promise<{
    file: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { file } = await context.params;
  const planId = file.replace(/\.md$/i, "");
  const plan = getPlan(planId);

  if (!plan) {
    return NextResponse.json({ error: "计划不存在" }, { status: 404 });
  }

  const markdown = planToMarkdown(plan);
  return new NextResponse(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${encodeURIComponent(plan.title)}.md"`,
    },
  });
}

