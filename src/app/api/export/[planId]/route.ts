import { NextResponse } from "next/server";
import {
  buildSubmitBundle,
  planToDocxBuffer,
  planToMarkdown,
  planToPdfBuffer,
  planToTasksWorkbook,
  scanPlanSensitive,
} from "@/lib/export";
import { getPlan } from "@/lib/db/queries";
import { generateProjectReport } from "@/lib/reports/generate-report";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { planId } = await context.params;
  const plan = getPlan(planId);

  if (!plan) {
    return NextResponse.json({ error: "计划不存在" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "md";
  const sensitiveFlags = scanPlanSensitive(plan);
  const headers: Record<string, string> = {};

  if (sensitiveFlags.length) {
    headers["X-Sensitive-Warning"] = encodeURIComponent(sensitiveFlags.join("; "));
  }

  if (format === "md") {
    return new NextResponse(planToMarkdown(plan), {
      headers: {
        ...headers,
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${encodeURIComponent(plan.title)}.md"`,
      },
    });
  }

  if (format === "docx") {
    const buffer = await planToDocxBuffer(plan);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        ...headers,
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${encodeURIComponent(plan.title)}.docx"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer = await planToPdfBuffer(plan);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        ...headers,
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${encodeURIComponent(plan.title)}.pdf"`,
      },
    });
  }

  if (format === "xlsx") {
    const buffer = await planToTasksWorkbook(plan);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        ...headers,
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${encodeURIComponent(plan.title)}.xlsx"`,
      },
    });
  }

  if (format === "bundle") {
    const { markdown } = await generateProjectReport(planId);
    const buffer = await buildSubmitBundle(plan, markdown);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        ...headers,
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${encodeURIComponent(plan.title)}-submit.zip"`,
      },
    });
  }

  return NextResponse.json({ error: "不支持的格式", supported: ["md", "docx", "pdf", "xlsx", "bundle"] }, { status: 400 });
}
