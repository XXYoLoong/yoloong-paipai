import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont } from "pdf-lib";
import type { PlanWithTasks } from "@/lib/types";
import { planToMarkdown } from "@/lib/export/markdown";
import { loadPdfFontBytes } from "@/lib/export/pdf-font";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 40;
const MARGIN_TOP = 800;
const MARGIN_BOTTOM = 60;
const MAX_TEXT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function wrapLine(text: string, font: PDFFont, size: number) {
  if (!text) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const char of text) {
    const next = current + char;
    if (font.widthOfTextAtSize(next, size) > MAX_TEXT_WIDTH) {
      if (current) {
        lines.push(current);
      }
      current = char;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export async function planToPdfBuffer(plan: PlanWithTasks) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await loadPdfFontBytes());
  const markdownLines = planToMarkdown(plan).split("\n");

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = MARGIN_TOP;

  for (const rawLine of markdownLines) {
    const trimmed = rawLine.trimEnd();
    const isHeading1 = trimmed.startsWith("# ");
    const isHeading2 = trimmed.startsWith("## ");
    const text = isHeading1
      ? trimmed.replace(/^#\s+/, "")
      : isHeading2
        ? trimmed.replace(/^##\s+/, "")
        : trimmed;
    const size = isHeading1 ? 16 : isHeading2 ? 13 : 10;
    const lineHeight = size + 6;
    const wrapped = wrapLine(text, font, size);

    for (const line of wrapped) {
      if (y < MARGIN_BOTTOM) {
        page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = MARGIN_TOP;
      }

      page.drawText(line || " ", {
        x: MARGIN_X,
        y,
        size,
        font,
      });
      y -= lineHeight;
    }
  }

  return Buffer.from(await pdf.save());
}
