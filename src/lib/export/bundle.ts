import { readFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import type { PlanWithTasks } from "@/lib/types";
import { planToDocxBuffer } from "@/lib/export/docx";
import { planToMarkdown } from "@/lib/export/markdown";
import { planToPdfBuffer } from "@/lib/export/pdf";
import { planToTasksWorkbook } from "@/lib/export/excel";

export async function buildSubmitBundle(plan: PlanWithTasks, reportMarkdown?: string) {
  const zip = new JSZip();
  const safeName = plan.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);

  zip.file(`${safeName}.md`, planToMarkdown(plan));
  zip.file(`${safeName}.docx`, await planToDocxBuffer(plan));
  zip.file(`${safeName}.pdf`, await planToPdfBuffer(plan));
  zip.file(`${safeName}-tasks.xlsx`, await planToTasksWorkbook(plan));

  if (reportMarkdown) {
    zip.file(`${safeName}-report.md`, reportMarkdown);
  }

  try {
    const aiStatement = await readFile(join(process.cwd(), "docs", "ai-tool-usage-statement.md"), "utf8");
    zip.file("AI_USAGE.md", aiStatement);
  } catch {
    zip.file(
      "AI_USAGE.md",
      "本项目使用 AI 辅助开发与报告润色，最终内容由本人审核后提交。详见 docs/ai-tool-usage-statement.md",
    );
  }

  zip.file(
    "README_EXPORT.txt",
    `游龙排排导出包\n计划：${plan.title}\n生成时间：${new Date().toLocaleString("zh-CN")}\n请勿将本包分享给未授权人员。`,
  );

  return zip.generateAsync({ type: "nodebuffer" });
}
