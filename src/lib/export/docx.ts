import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { PlanWithTasks } from "@/lib/types";
import { planToMarkdown } from "@/lib/export/markdown";

export async function planToDocxBuffer(plan: PlanWithTasks) {
  const markdown = planToMarkdown(plan);
  const paragraphs = markdown.split("\n").map((line) => {
    if (line.startsWith("# ")) {
      return new Paragraph({ text: line.replace(/^#\s+/, ""), heading: HeadingLevel.HEADING_1 });
    }
    if (line.startsWith("## ")) {
      return new Paragraph({ text: line.replace(/^##\s+/, ""), heading: HeadingLevel.HEADING_2 });
    }
    return new Paragraph({ children: [new TextRun(line || " ")] });
  });

  const doc = new Document({
    sections: [
      {
        children: paragraphs,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
