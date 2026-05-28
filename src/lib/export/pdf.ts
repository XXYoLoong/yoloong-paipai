import { PDFDocument, StandardFonts } from "pdf-lib";
import type { PlanWithTasks } from "@/lib/types";
import { planToMarkdown } from "@/lib/export/markdown";

export async function planToPdfBuffer(plan: PlanWithTasks) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const lines = planToMarkdown(plan).split("\n");

  let page = pdf.addPage([595, 842]);
  let y = 800;
  const lineHeight = 14;

  for (const line of lines) {
    if (y < 60) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    const safe = line.replace(/[^\x00-\x7F]/g, "?");
    page.drawText(safe.slice(0, 90), { x: 40, y, size: 10, font });
    y -= lineHeight;
  }

  return Buffer.from(await pdf.save());
}
